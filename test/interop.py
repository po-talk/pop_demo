#!/usr/bin/env python3
"""相互通話テスト：本番の画面（/）とお試し版（/pop_demo/）が同じ部屋で話せるか

    python3 test/interop.py                # サーバも Chrome も自前で起動（ポート 8000＝TURN 経由まで試せる）
    python3 test/interop.py --headful      # 画面を出して眺める
    python3 test/interop.py --no-serve     # 既に test/serve.py が動いているならそれを使う

見ること（両方向）：
  1. 本番の画面で部屋を作る → その招待リンクをお試し版で開いて参加できる
  2. お互いを相手として認識する（人数・名前）
  3. お互いの声（偽マイク）が届く＝受信トラックが live かつ muted でない
  4. お試し版が退出すると、本番の画面から相手が消える

本番側は元の DOM（#room・#join・#members）で操作する。お試し版は見た目を作り替えるので
DOM には頼らず window.__pop（index.html の末尾）で操作・観測する。
"""

import argparse
import json
import os
import random
import shutil
import string
import subprocess
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cdp   # noqa: E402

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
DISCOVER = 60

ERRS = r"""(() => { const E = window.__E = []; addEventListener('error', e => E.push(String(e.message)));
  addEventListener('unhandledrejection', e => E.push('rejection: ' + e.reason));
  addEventListener('securitypolicyviolation', e => E.push('csp: ' + e.effectiveDirective + ' ' + e.blockedURI)) })()"""
# 相手の声が実際に流れているか（DOM の id に頼らない：どちらの画面でも同じ式で測れる）
FLOWING = ("[...document.querySelectorAll('audio:not(#appAudio)')].filter(a => a.srcObject &&"
           " a.srcObject.getAudioTracks().some(t => t.readyState === 'live' && !t.muted)).length")
UP_BOOTED = "typeof document.getElementById('join').onclick === 'function'"
UP_MEMBERS = "document.querySelectorAll('#members .member').length"
UP_JOIN = ("(() => { const j = document.getElementById('join'), o = document.getElementById('entryOpen');"
           " if (o && o.offsetParent) o.click(); j.click() })()")
POP = "window.__pop.state()"


class Run:
    def __init__(self, a):
        self.a, self.tabs, self.ok = a, [], True

    def check(self, name, ok, note=''):
        self.ok &= bool(ok)
        print(('  ✅ ' if ok else '  ❌ ') + name + ('' if ok or not note else '  … ' + note))

    def start(self):
        self.srv = None
        if not self.a.no_serve:
            self.srv = subprocess.Popen([sys.executable, os.path.join(HERE, 'test', 'serve.py'),
                                         '--port', str(self.a.web_port), '--tag', self.a.tag],
                                        stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
            time.sleep(0.6)
            if self.srv.poll() is not None:
                sys.exit('サーバを起動できません（ポート %d 使用中？ --no-serve で相乗りできます）' % self.a.web_port)
        self.profile = tempfile.mkdtemp(prefix='popdemo-test-')
        flags = [CHROME, '' if self.a.headful else '--headless=new', '--remote-debugging-port=%d' % self.a.port,
                 '--user-data-dir=' + self.profile, '--no-first-run', '--no-default-browser-check',
                 '--use-fake-device-for-media-capture', '--use-fake-ui-for-media-stream',
                 '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--disable-gpu', 'about:blank']
        self.chrome = subprocess.Popen([f for f in flags if f], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        cdp.wait_for_devtools(self.a.port)

    def tab(self, path):
        t = cdp.new_tab(self.a.port)
        self.tabs.append(t)
        t.call('Page.enable'); t.call('Runtime.enable')
        t.call('Page.addScriptToEvaluateOnNewDocument', source=ERRS)
        t.call('Page.navigate', url='http://localhost:%d%s' % (self.a.web_port, path))
        return t

    def stop(self):
        for t in self.tabs:
            try: t.close()
            except Exception: pass
        try: self.chrome.terminate(); self.chrome.wait(timeout=5)
        except Exception: pass
        if self.srv: self.srv.terminate()
        shutil.rmtree(self.profile, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--web-port', type=int, default=8000)   # TURN Worker が許すのは localhost:8000 だけ
    ap.add_argument('--port', type=int, default=9341, help='Chrome の devtools ポート')
    ap.add_argument('--tag', default='interop')
    ap.add_argument('--no-serve', action='store_true')
    ap.add_argument('--headful', action='store_true')
    r = Run(ap.parse_args())
    room = '相互テスト-' + ''.join(random.choices(string.ascii_lowercase, k=5))
    r.start()
    try:
        print('部屋: ' + room)
        up = r.tab('/')
        r.check('本番の画面が起動する', up.wait_for(UP_BOOTED, timeout=20))
        up.eval("(() => { const r = document.getElementById('room'); r.value = %s; r.dispatchEvent(new Event('input')) })()"
                % json.dumps(room))
        up.eval(UP_JOIN, await_promise=False)
        r.check('本番の画面で部屋を作れる', up.wait_for("location.hash.startsWith('#room=')", timeout=DISCOVER),
                up.eval("document.getElementById('state').textContent"))
        link = up.eval('location.hash')

        pop = r.tab('/pop_demo/' + link)
        r.check('お試し版が起動する', pop.wait_for('!!window.__pop', timeout=20), str(pop.eval('window.__E')))
        pop.wait_for("%s.entry !== 'checking'" % POP, timeout=DISCOVER)
        pop.eval('window.__pop.join()', await_promise=False)
        r.check('お試し版がリンクから同じ部屋に入る',
                pop.wait_for("%s.joined === %s" % (POP, json.dumps(link.split('&')[0][len('#room='):])), timeout=DISCOVER),
                json.dumps(pop.eval(POP), ensure_ascii=False))
        r.check('本番の画面がお試し版を認識する（2人）', up.wait_for('%s === 2' % UP_MEMBERS, timeout=DISCOVER))
        r.check('お試し版が本番の画面の人を認識する', pop.wait_for('%s.peers.length === 1 && %s.names[0] !== null' % (POP, POP), timeout=DISCOVER),
                json.dumps(pop.eval(POP), ensure_ascii=False))
        r.check('本番の画面にお試し版の声が届く', up.wait_for('%s >= 1' % FLOWING, timeout=DISCOVER))
        r.check('お試し版に本番の画面の声が届く', pop.wait_for('%s >= 1 && %s.flowing >= 1' % (FLOWING, POP), timeout=DISCOVER),
                json.dumps(pop.eval(POP), ensure_ascii=False))
        if r.a.web_port == 8000:
            # 本番の画面の参加者行は、経路を .m-conn.relay（☁ TURN 中継）／.m-conn.direct（↔ 直結）で示す。
            # 相手の行（自分以外）が relay なら、お試し版との間も TURN を通っている
            conn = "[...document.querySelectorAll('#members .member .m-conn')].map(e => e.className).join(' | ')"
            relay = up.wait_for("document.querySelectorAll('#members .member .m-conn.relay').length === 2", timeout=20)
            r.check('TURN 経由でつながる（本番と同じ relay-first）', relay, up.eval(conn))
        pop.eval('window.__pop.leave()', await_promise=False)
        r.check('お試し版の退出が本番の画面に伝わる', up.wait_for('%s === 1' % UP_MEMBERS, timeout=30))
        errs = (up.eval('window.__E') or []) + (pop.eval('window.__E') or [])
        if r.a.web_port != 8000:
            # TURN Worker は localhost:8000 しか許可しない＝他のポートでは資格情報が取れず直結で続行（想定内）
            errs = [e for e in errs if 'pot-turn' not in e]

        r.check('エラー・CSP 違反なし', not errs, '; '.join(errs))
    finally:
        r.stop()
    print('\n' + ('すべて通過' if r.ok else '失敗あり'))
    return 0 if r.ok else 1


if __name__ == '__main__':
    sys.exit(main())
