#!/usr/bin/env python3
"""2 人で通話した状態のお試し版を写す（本番の画面の相手と一緒に）

    python3 test/duo.py OUT_PREFIX [--steps chat,settings,react]

test/serve.py が 8000 で動いている前提。本番の画面（/）で部屋を作り、その招待リンクでお試し版（/pop_demo/）が入る。
相手（本番の画面）からひとこととリアクションを送り、お試し版の画面を段階ごとに撮る。
"""
import argparse, base64, json, os, random, shutil, string, subprocess, sys, tempfile, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cdp  # noqa
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
ERRS = r"""(() => { const E = window.__E = []; addEventListener('error', e => E.push(String(e.message) + ' @' + e.lineno));
  addEventListener('unhandledrejection', e => E.push('rejection: ' + e.reason)); addEventListener('securitypolicyviolation', e => E.push('csp: ' + e.blockedURI)) })()"""
ap = argparse.ArgumentParser(); ap.add_argument('out'); ap.add_argument('--steps', default='chat,settings,react'); ap.add_argument('--port', type=int, default=9361); ap.add_argument('--lobby', action='store_true', help='お試し版はリンクなしで開き、ロビーの泡から入る')
a = ap.parse_args()
prof = tempfile.mkdtemp(prefix='popduo-')
ch = subprocess.Popen([CHROME, '--headless=new', '--remote-debugging-port=%d' % a.port, '--user-data-dir=' + prof, '--no-first-run', '--hide-scrollbars',
                       '--use-fake-device-for-media-capture', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio', 'about:blank'],
                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def tab(url, mobile):
    t = cdp.new_tab(a.port); t.call('Page.enable'); t.call('Runtime.enable')
    if mobile:
        t.call('Emulation.setDeviceMetricsOverride', width=390, height=844, deviceScaleFactor=2, mobile=True)
    t.call('Page.addScriptToEvaluateOnNewDocument', source=ERRS + ";try{localStorage.setItem('pop-call-hide-help','1');localStorage.setItem('pot-call-hide-help','1')}catch{}")
    t.call('Page.navigate', url=url); return t
def snap(t, name):
    d = t.call('Page.captureScreenshot', format='png'); p = a.out + '-' + name + '.png'
    open(p, 'wb').write(base64.b64decode(d['data'])); print('saved', p)
try:
    cdp.wait_for_devtools(a.port)
    room = 'デュオ-' + ''.join(random.choices(string.ascii_lowercase, k=4))
    up = tab('http://localhost:8000/', False)
    up.wait_for("typeof document.getElementById('join').onclick === 'function'", timeout=20)
    up.eval("(() => { const r = document.getElementById('room'); r.value = %s; r.dispatchEvent(new Event('input')); document.getElementById('join').click() })()" % json.dumps(room), await_promise=False)
    up.wait_for("location.hash.startsWith('#room=')", timeout=60)
    link = up.eval('location.hash')
    if a.lobby:
        pop = tab('http://localhost:8000/pop_demo/', True)
        pop.wait_for('!!window.__pop && !!window.__zg', timeout=20)
        pop.wait_for("document.querySelectorAll('#lobbyList button.room').length > 0", timeout=60)
        time.sleep(2); pop.eval("window.__zg.space.view(0, 0, 1300)"); time.sleep(2); snap(pop, '0lobby')
        # 何度も出し直す（間に在室の描き直しを挟む）。毎回、問いの泡が部屋の泡のそばに出るか
        GAP = ("(() => { const a = document.getElementById('roomAsk'), r = document.querySelector('#lobbyList button.room:not(.here)');"
               " if (!a || !r) return -1; const p = a.getBoundingClientRect(), q = r.getBoundingClientRect();"
               " return Math.round(Math.hypot(p.x + p.width/2 - q.x - q.width/2, p.y + p.height/2 - q.y - q.height/2) - (p.width + q.width)/2) })()")
        for k in range(4):
            pop.eval("document.querySelector('#lobbyList button.room').click()"); time.sleep(1.5)
            g = pop.eval(GAP); print('  ask gap try', k, g, '✅' if 0 <= g < 40 else '❌')
            if k < 3: pop.eval("document.getElementById('roomAskNo').click()"); time.sleep(6)
        snap(pop, '0ask')
        pop.eval("document.getElementById('roomAskYes').click()")
    else:
        pop = tab('http://localhost:8000/pop_demo/' + link, True)
        pop.wait_for('!!window.__pop && !!window.__zg', timeout=20)
        pop.wait_for("window.__pop.state().entry !== 'checking'", timeout=60)
        time.sleep(1.5); snap(pop, '0link')
        pop.eval("document.getElementById('linkJoin').click()", await_promise=False)   # 人と同じく、リンクの部屋の泡の ✓ から入る
    pop.wait_for('window.__pop.state().peers.length === 1', timeout=60)
    time.sleep(3)
    # 声の大きさ：偽マイクの音で、相手の泡の --lv が上がり、部屋の底から泡が湧くか（数秒見て最大を取る）
    # ヘッドレスの偽マイクは無音（本番の画面も反応しない）ので、音量を差し込んで見た目だけ確かめる
    pop.eval("(() => { window.__zg.eqTest = 0.8; const m = document.querySelector('#members .member'); m.classList.add('speaking'); m.style.setProperty('--lv', '0.9'); m._lv = 0.9; setInterval(() => { const m = document.querySelector('#members .member'); if (m) { m.classList.add('speaking'); m.style.setProperty('--lv','0.9'); m._lv = 0.9 } }, 50) })()")
    time.sleep(1.5)
    mx = {'lv': 0, 'eq': 0}
    for _ in range(20):
        v = pop.eval("JSON.stringify({ lv: Math.max(0, ...[...document.querySelectorAll('#members .member')].map(e => +(e.style.getPropertyValue('--lv') || 0))), eq: document.querySelectorAll('.eq-bub').length })")
        v = json.loads(v); mx['lv'] = max(mx['lv'], v['lv']); mx['eq'] = max(mx['eq'], v['eq']); time.sleep(0.25)
    print('  glow box-shadow', pop.eval("(() => { const m = document.querySelector('#members .member'); m.classList.add('speaking'); m.style.setProperty('--lv','0.9'); return getComputedStyle(m).boxShadow.slice(0, 90) })()"))
    snap(pop, '1glow')
    print('  up speaking ever?', up.eval("document.querySelectorAll('#members .speaking').length"), ' pop transforms', pop.eval("[...document.querySelectorAll('#members .m-emoji')].map(e => e.style.transform).join(',')"))
    print('  voice level max', mx['lv'], ' rising bubbles max', mx['eq'], '✅' if mx['lv'] > 0 and mx['eq'] > 0 else '❌')
    snap(pop, '1call')
    up.eval("(() => { const t = document.getElementById('chatText'); t.value = 'こんばんは〜 はじめまして！'; document.getElementById('chatSend').click() })()")
    time.sleep(1.5); snap(pop, '2said')
    for st in a.steps.split(','):
        if st == 'chat':
            pop.eval("document.getElementById('tabChat').click()"); time.sleep(2.5)
            up.eval("(() => { const t = document.getElementById('chatText'); t.value = 'この部屋、泡が浮いてて楽しいですね。ひとことが円に沿って並ぶのを見てみたい'; document.getElementById('chatSend').click() })()")
            pop.eval("(() => { const t = document.getElementById('chatText'); t.value = 'ほんとだ、ふわふわしてる'; document.getElementById('chatSend').click() })()")
            time.sleep(1.5); snap(pop, '3chat'); pop.eval("document.getElementById('tabChat').click()"); time.sleep(1.5)
        if st == 'settings':
            pop.eval("document.getElementById('tabSettings').click()"); time.sleep(2.5); snap(pop, '4settings'); pop.eval("document.getElementById('tabSettings').click()"); time.sleep(1.5)
        if st == 'ignore':
            print('ig buttons:', pop.eval("[...document.querySelectorAll('#members button')].map(b => b.className + ':' + b.getAttribute('aria-label')).join(' | ')"))
            pop.eval("document.querySelector('#members .m-ig:not([disabled])').click()"); time.sleep(1.5); snap(pop, '6ignore')
            print('dialog open:', pop.eval("document.getElementById('ignoreDlg').open"))
            pop.eval("document.getElementById('ignoreYes').click()"); time.sleep(1.5); snap(pop, '6ignored')
        if st == 'qr':
            pop.eval("document.getElementById('qr').click()"); time.sleep(2.5); snap(pop, '7qr'); pop.eval("document.getElementById('qr').click()"); time.sleep(1)
        if st == 'tag':
            pop.eval("document.getElementById('tagEdit').click()"); time.sleep(1.5)
            pop.eval("(() => { const t = document.getElementById('tagInput'); t.value = 'お昼ご飯の献立'; document.getElementById('tagSend').click() })()"); time.sleep(1.5); snap(pop, '8tag')
        if st == 'leave':
            pop.eval("document.getElementById('leave').click()"); time.sleep(1); pop.eval("document.getElementById('leaveYes').click()"); time.sleep(3); snap(pop, '9left')
        if st == 'react':
            pop.eval("document.getElementById('reactBtn').click()"); time.sleep(1.5)
            up.eval("document.querySelectorAll('#reactions button')[6].click()")
            pop.eval("document.querySelectorAll('#reactions button')[0].click()"); time.sleep(0.5); snap(pop, '5react')
    print('errors pop:', pop.eval('window.__E'), ' up:', up.eval('window.__E'))
finally:
    ch.terminate(); shutil.rmtree(prof, ignore_errors=True)
