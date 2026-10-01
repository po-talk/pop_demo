#!/usr/bin/env python3
"""通話中の部屋がたくさん浮かぶスクリーンショット（紹介用）。架空の部屋は __zg.demoRooms で自分の画面にだけ出す

    python3 test/lobbyshot.py OUT_PREFIX      # スマホ縦（390×844）と横長（1200×630）を撮る
test/serve.py が 8000 で動いている前提。本番の画面の相手と 2 人で実際に通話した状態で撮る。
"""
import base64, json, os, random, shutil, string, subprocess, sys, tempfile, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cdp  # noqa
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
out = sys.argv[1]; port = 9381
ROOMS = [
  {'name': 'もくもく作業部屋 ☕', 'talk': 1, 'people': [['🦝', 'たぬき'], ['🐨', 'こあら', 1], ['🐧', 'ぺん', 1]]},
  {'name': 'アイデア会議', 'talk': 3, 'people': [['🦉', 'ふくろう'], ['🐭', 'ねずみ'], ['🐹', 'はむ'], ['🐰', 'うさ', 1]]},
  {'name': '夜のラジオ', 'bc': True, 'talk': 2, 'people': [['🦊', 'DJきつね'], ['🐱', 'ねこ', 1], ['🐶', 'いぬ', 1], ['🐼', 'ぱんだ', 1], ['🐻', 'くま', 1]]},
  {'name': 'ゲームの話', 'talk': 2, 'people': [['🐙', 'たこ'], ['🦄', 'ゆに']]},
  {'name': '朝活🌅', 'talk': 0, 'people': [['🌸', 'さくら', 1]]},
  {'name': 'お昼休み', 'talk': 1, 'tag': 'お弁当の中身', 'people': [['🍣', 'すし'], ['🍎', 'りんご'], ['⭐', 'ほし', 1]]},
  {'name': '作業用BGM部屋', 'talk': 0, 'people': [['🐝', 'はち', 1], ['🐸', 'かえる', 1]]},
  {'name': '雑談ひろば', 'talk': 3, 'people': [['🦞', 'えび'], ['🐶', 'しば'], ['🐱', 'みけ'], ['🦉', 'もり'], ['🐧', 'ぎん', 1], ['🐻', 'くまお', 1]]},
]
prof = tempfile.mkdtemp(prefix='poplobby-')
ch = subprocess.Popen([CHROME, '--headless=new', '--remote-debugging-port=%d' % port, '--user-data-dir=' + prof, '--no-first-run', '--hide-scrollbars',
                       '--use-fake-device-for-media-capture', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio', 'about:blank'],
                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def tab(url, w, h, mobile, who=('🦊', 'あなた')):
    t = cdp.new_tab(port); t.call('Page.enable'); t.call('Runtime.enable')
    t.call('Emulation.setDeviceMetricsOverride', width=w, height=h, deviceScaleFactor=2, mobile=mobile)
    # 同じブラウザ（＝同じ保存）なので、タブごとに読み込みの直前で名前と絵文字を書いておく
    pf = json.dumps({'emoji': who[0], 'name': who[1]}, ensure_ascii=False)
    t.call('Page.addScriptToEvaluateOnNewDocument', source="try{['pop','pot'].forEach(p=>{localStorage.setItem(p+'-call-hide-help','1');localStorage.setItem(p+'-call-profile',%s)})}catch{}" % json.dumps(pf))
    t.call('Page.navigate', url=url); return t
def snap(t, name):
    d = t.call('Page.captureScreenshot', format='png'); p = out + '-' + name + '.png'
    open(p, 'wb').write(base64.b64decode(d['data'])); print('saved', p)
try:
    cdp.wait_for_devtools(port)
    room = 'ポッポの森'
    up = tab('http://localhost:8000/', 800, 900, False, ('🐱', 'みけねこ'))
    up.wait_for("typeof document.getElementById('join').onclick === 'function'", timeout=20)
    up.eval("(() => { const r = document.getElementById('room'); r.value = %s; r.dispatchEvent(new Event('input')); document.getElementById('join').click() })()" % json.dumps(room), await_promise=False)
    up.wait_for("location.hash.startsWith('#room=')", timeout=60)
    link = up.eval('location.hash')
    up2 = tab('http://localhost:8000/' + link, 800, 900, False, ('🐼', 'ぱんだ'))
    up2.wait_for("typeof document.getElementById('join').onclick === 'function'", timeout=20)
    up2.wait_for("(() => { const j = document.getElementById('join'); return !j.disabled && !j.hidden })()", timeout=60)
    up2.eval("document.getElementById('join').click()", await_promise=False)
    up2.wait_for("document.getElementById('state').textContent.includes('通話中')", timeout=60)
    for name, w, h, mobile, span in (('phone', 390, 844, True, 1500), ('wide', 1200, 630, False, 1250)):
        pop = tab('http://localhost:8000/pop_demo/' + link, w, h, mobile)
        pop.wait_for('!!window.__zg', timeout=20)
        pop.wait_for("window.__pop.state().entry !== 'checking'", timeout=60)
        time.sleep(2)
        pop.eval('window.__pop.join()', await_promise=False)
        if not pop.wait_for('window.__pop.state().peers.length >= 2', timeout=60): print('join failed', pop.eval('JSON.stringify(window.__pop.state())'))
        # 部屋の中で相手が少し話した感じに（ひとことの吹き出し）
        time.sleep(3)
        pop.eval("window.__zg.demoRooms(%s)" % json.dumps(ROOMS, ensure_ascii=False))
        time.sleep(4)
        pop.eval("(() => { const s = window.__zg.space, c = s.bodies.find(b => b.el.id === 'callBub'); s.view(c.x + 60, c.y, %d) })()" % span)
        time.sleep(2)
        up.eval("(() => { const t = document.getElementById('chatText'); t.value = 'ようこそ〜！'; document.getElementById('chatSend').click() })()")
        time.sleep(1.2); snap(pop, name)
        pop.eval('window.__pop.leave()'); time.sleep(2)
        pop.eval("window.__zg.demoRooms(null)"); pop.close()
finally:
    ch.terminate(); shutil.rmtree(prof, ignore_errors=True)
