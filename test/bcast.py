#!/usr/bin/env python3
"""配信部屋の相互テスト（お試し版 ↔ 本番の画面）を写しながら確かめる

    python3 test/bcast.py OUT_PREFIX [--role owner|listener]

owner   … お試し版が配信者（📣 で作る）、本番の画面が聞き役。通話希望→許可→おたより の流れ
listener… 本番の画面が配信者、お試し版が聞き役
test/serve.py が 8000 で動いている前提。
"""
import argparse, base64, json, os, random, shutil, string, subprocess, sys, tempfile, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cdp  # noqa
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
ERRS = r"""(() => { const E = window.__E = []; addEventListener('error', e => E.push(String(e.message) + ' @' + e.lineno));
  addEventListener('unhandledrejection', e => E.push('rejection: ' + e.reason)); addEventListener('securitypolicyviolation', e => E.push('csp: ' + e.blockedURI)) })()"""
ap = argparse.ArgumentParser(); ap.add_argument('out'); ap.add_argument('--role', default='owner'); ap.add_argument('--port', type=int, default=9371)
a = ap.parse_args()
prof = tempfile.mkdtemp(prefix='popbc-'), tempfile.mkdtemp(prefix='popbc2-')
chs = []
def chrome(port, p):
    chs.append(subprocess.Popen([CHROME, '--headless=new', '--remote-debugging-port=%d' % port, '--user-data-dir=' + p, '--no-first-run', '--hide-scrollbars',
        '--use-fake-device-for-media-capture', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio', 'about:blank'],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    cdp.wait_for_devtools(port)
def tab(port, url, mobile):
    t = cdp.new_tab(port); t.call('Page.enable'); t.call('Runtime.enable')
    if mobile: t.call('Emulation.setDeviceMetricsOverride', width=390, height=844, deviceScaleFactor=2, mobile=True)
    t.call('Page.addScriptToEvaluateOnNewDocument', source=ERRS + ";try{['pop','pot'].forEach(p=>{localStorage.setItem(p+'-call-hide-help','1');localStorage.setItem(p+'-call-ignore-seen','1')})}catch{}")
    t.call('Page.navigate', url=url); return t
def snap(t, name):
    d = t.call('Page.captureScreenshot', format='png'); p = a.out + '-' + name + '.png'
    open(p, 'wb').write(base64.b64decode(d['data'])); print('saved', p)
def ok(label, v): print(('  ✅ ' if v else '  ❌ ') + label); return v
try:
    # 別々のブラウザ（＝別の人。localStorage も配信の鍵も分かれる）
    chrome(a.port, prof[0]); chrome(a.port + 1, prof[1])
    room = '配信テスト-' + ''.join(random.choices(string.ascii_lowercase, k=4))
    if a.role == 'owner':
        pop = tab(a.port, 'http://localhost:8000/pop_demo/', True)
        pop.wait_for('!!window.__zg', timeout=20)
        pop.eval("document.getElementById('createBtn').click()"); time.sleep(.5)
        pop.eval("(() => { const r = document.getElementById('room'); r.value = %s; r.dispatchEvent(new Event('input')); document.getElementById('kindBcL').click() })()" % json.dumps(room))
        time.sleep(1); snap(pop, '0create')
        pop.eval("document.getElementById('join').click()", await_promise=False)
        ok('お試し版が配信部屋を作る', pop.wait_for("location.hash.includes('~pk~')", timeout=60))
        link = pop.eval('location.hash')
        up = tab(a.port + 1, 'http://localhost:8000/' + link, False)
        up.wait_for("typeof document.getElementById('join').onclick === 'function'", timeout=20)
        up.wait_for("(() => { const j = document.getElementById('join'); return !j.disabled && !j.hidden })()", timeout=60)
        up.eval("document.getElementById('join').click()", await_promise=False)
        ok('本番の画面が聞き役で入る', up.wait_for("document.getElementById('state').textContent.includes('通話中')", timeout=60))
        time.sleep(3); snap(pop, '1owner')
        # 通話希望の募集 → 聞き役が手を挙げる → 許可
        pop.eval("document.getElementById('tabSettings').click()"); time.sleep(2); snap(pop, '2settings')
        pop.eval("document.getElementById('reqOpenRow').click()"); time.sleep(1)
        pop.eval("document.getElementById('tabSettings').click()"); time.sleep(1)
        ok('聞き役に「通話希望」が出る', up.wait_for("!document.getElementById('raise').hidden", timeout=20))
        up.eval("document.getElementById('raise').click()")
        ok('配信者の画面に 🙋 の泡が出る', pop.wait_for("[...document.querySelectorAll('#members .member')].length === 2", timeout=20))
        time.sleep(1.5); snap(pop, '3raised')
        pop.eval("document.querySelector('#members .m-mic:not([disabled])').click()")
        ok('許可すると聞き役に「マイクを使う」', up.wait_for("getComputedStyle(document.getElementById('speak')).display !== 'none'", timeout=20))
        # おたより：募集 → 投稿 → 公開
        pop.eval("document.getElementById('tabMail').click()"); time.sleep(1.5)
        pop.eval("(() => { const t = document.getElementById('mailText'); t.value = '最近うれしかったこと'; document.getElementById('mailSend').click() })()"); time.sleep(1.5)
        up.eval("document.getElementById('tabMail').click()"); time.sleep(1)
        up.eval("(() => { const t = document.getElementById('mailText'); t.value = '駅前のパン屋さんが新しくなりました！'; document.getElementById('mailSend').click() })()")
        time.sleep(2); snap(pop, '4mail')
        pop.eval("(() => { const b = [...document.querySelectorAll('#mailBody button')].find(b => b.textContent.includes('公開')); b && b.click() })()")
        ok('お便りの紙が出る', pop.wait_for("!document.getElementById('mailPop').hidden", timeout=15))
        time.sleep(1.5); snap(pop, '5pop')
    else:
        up = tab(a.port + 1, 'http://localhost:8000/', False)
        up.wait_for("typeof document.getElementById('join').onclick === 'function'", timeout=20)
        up.eval("(() => { document.querySelector('#createBox summary').click(); const r = document.getElementById('room'); r.value = %s; r.dispatchEvent(new Event('input')); const k = document.getElementById('kindBc'); k.checked = true; k.dispatchEvent(new Event('change')) })()" % json.dumps(room))
        time.sleep(1.5); up.eval("document.getElementById('join').click()", await_promise=False)
        ok('本番の画面が配信部屋を作る', up.wait_for("location.hash.includes('~pk~')", timeout=60))
        link = up.eval('location.hash')
        up.eval("(() => { document.getElementById('tabSettings').click(); const r = document.getElementById('reqOpen'); r.checked = true; r.dispatchEvent(new Event('change')) })()")
        pop = tab(a.port, 'http://localhost:8000/pop_demo/' + link, True)
        pop.wait_for('!!window.__zg', timeout=20)
        pop.wait_for("window.__pop.state().entry !== 'checking'", timeout=60)
        time.sleep(1); snap(pop, '0entry')
        pop.eval('window.__pop.join()', await_promise=False)
        ok('お試し版が聞き役で入る', pop.wait_for('window.__pop.state().peers.length === 1', timeout=60))
        time.sleep(4); snap(pop, '1listener')
        # ★元のアプリの競合（v0.15.18）：入室の瞬間に配信者が送る「募集中」は、聞き役がまだ配信者を知らない
        #   （名簿の検証前）と捨てられる。本番の画面どうしでも同じ。ここでは入ったあとに募集を入れ直す
        up.eval("(() => { const r = document.getElementById('reqOpen'); r.checked = false; r.dispatchEvent(new Event('change')); r.checked = true; r.dispatchEvent(new Event('change')) })()")
        ok('お試し版に「通話希望」の泡', pop.wait_for("getComputedStyle(document.getElementById('raise')).display !== 'none' && !document.getElementById('raise').hidden", timeout=20))
        pop.eval("document.getElementById('raise').click()"); time.sleep(2); snap(pop, '2raised')
        up.eval("document.getElementById('tabMail').click()"); time.sleep(1)
        up.eval("(() => { const t = document.getElementById('mailText'); t.value = '最近うれしかったこと'; document.getElementById('mailSend').click() })()"); time.sleep(2)
        pop.eval("document.getElementById('tabMail').click()"); time.sleep(2); snap(pop, '3mail')
        pop.eval("(() => { const t = document.getElementById('mailText'); t.value = '駅前のパン屋さんが新しくなりました！'; document.getElementById('mailSend').click() })()"); time.sleep(2)
        up.eval("(() => { const b = [...document.querySelectorAll('#mailBody button')].find(b => b.textContent.includes('公開')); b && b.click() })()")
        ok('お試し版にお便りの紙が出る', pop.wait_for("!document.getElementById('mailPop').hidden", timeout=15))
        time.sleep(1.5); snap(pop, '4pop')
    print('errors pop:', pop.eval('window.__E'), ' up:', up.eval('window.__E'))
finally:
    for c in chs: c.terminate()
    for p in prof: shutil.rmtree(p, ignore_errors=True)
