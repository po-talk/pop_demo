#!/usr/bin/env python3
"""泡になった人どうしが見えるか（ロビーの 'solo' action）。2 つの別ブラウザで ✓ を選び、互いの泡が出るか。
本番の画面（/）も同じロビーに居させて、エラーが出ないこと（知らない action を黙って捨てる）も見る。
    python3 test/solo.py OUT_PREFIX     # test/serve.py が 8000 で動いている前提
"""
import base64, json, os, shutil, subprocess, sys, tempfile, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cdp  # noqa
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
ERRS = r"""(() => { const E = window.__E = []; addEventListener('error', e => E.push(String(e.message) + ' @' + e.lineno)); addEventListener('unhandledrejection', e => E.push('rejection: ' + e.reason)) })()"""
out = sys.argv[1]; chs, profs = [], []
def chrome(port):
    p = tempfile.mkdtemp(prefix='popsolo-'); profs.append(p)
    chs.append(subprocess.Popen([CHROME, '--headless=new', '--remote-debugging-port=%d' % port, '--user-data-dir=' + p, '--no-first-run', '--hide-scrollbars',
        '--use-fake-device-for-media-capture', '--use-fake-ui-for-media-stream', '--mute-audio', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    cdp.wait_for_devtools(port)
def tab(port, url, who):
    t = cdp.new_tab(port); t.call('Page.enable'); t.call('Runtime.enable')
    t.call('Emulation.setDeviceMetricsOverride', width=390, height=844, deviceScaleFactor=2, mobile=True)
    pf = json.dumps({'emoji': who[0], 'name': who[1]}, ensure_ascii=False)
    t.call('Page.addScriptToEvaluateOnNewDocument', source=ERRS + ";try{localStorage.setItem('pop-call-profile',%s);localStorage.setItem('pot-call-profile',%s)}catch{}" % (json.dumps(pf), json.dumps(pf)))
    t.call('Page.navigate', url=url); return t
def ok(label, v): print(('  ✅ ' if v else '  ❌ ') + label); return v
try:
    for port in (9391, 9392, 9393): chrome(port)
    A = tab(9391, 'http://localhost:8000/pop_demo/', ('🐙', 'たこ'))
    B = tab(9392, 'http://localhost:8000/pop_demo/', ('🦄', 'ゆに'))
    U = tab(9393, 'http://localhost:8000/', ('🐱', 'みけ'))   # 本番の画面（solo を知らない）
    for t in (A, B): t.wait_for('!!window.__zg', timeout=30)
    time.sleep(6)
    for t in (A, B):
        t.eval("(() => { document.getElementById('helpClose').click(); setTimeout(() => { document.getElementById('frost').click(); setTimeout(() => document.getElementById('introYes').click(), 400) }, 600) })()")
    ok('A に B の泡が出る', A.wait_for("[...window.__zg.soloPeers.values()].some(r => r.e === '🦄')", timeout=60))
    ok('B に A の泡が出る', B.wait_for("[...window.__zg.soloPeers.values()].some(r => r.e === '🐙')", timeout=60))
    time.sleep(2)
    d = A.call('Page.captureScreenshot', format='png'); open(out + '-solo.png', 'wb').write(base64.b64decode(d['data']))
    # B が部屋に入る（自分の部屋を作る）→ A から消える。※自分の泡を押して触っている間は消えない（0.7.2）
    B.eval("(() => { document.getElementById('createBtn').click(); setTimeout(() => document.getElementById('join').click(), 400) })()")
    ok('名前は送られていない（絵文字だけ）', A.eval("[...window.__zg.soloPeers.values()].every(r => r.n === undefined)"))
    ok('B が部屋に入ると A から消える', A.wait_for("![...window.__zg.soloPeers.values()].some(r => r.e === '🦄')", timeout=20))
    errs = (A.eval('window.__E') or []) + (B.eval('window.__E') or []) + (U.eval('window.__E') or [])
    ok('本番の画面を含めエラーなし', not errs) or print('   ', errs)
finally:
    for c in chs: c.terminate()
    for p in profs: shutil.rmtree(p, ignore_errors=True)
