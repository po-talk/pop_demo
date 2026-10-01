#!/usr/bin/env python3
"""画面写し：ページを開いて少し待ち、スクリーンショットを撮る（見た目の確認用）

    python3 test/shot.py URL out.png [--w 390 --h 844 --wait 3 --js "式" --then 2]

--w/--h はスマホ相当（既定 390×844・mobile 扱い）。--js は待ったあとに評価する式、--then はその後さらに待つ秒数。
ページのエラー（error/unhandledrejection/CSP 違反）は標準出力に出す。
"""
import argparse, base64, os, shutil, subprocess, sys, tempfile, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cdp  # noqa: E402

CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
ERRS = r"""(() => { const E = window.__E = []; addEventListener('error', e => E.push(String(e.message) + ' @' + e.filename + ':' + e.lineno));
  addEventListener('unhandledrejection', e => E.push('rejection: ' + e.reason));
  addEventListener('securitypolicyviolation', e => E.push('csp: ' + e.effectiveDirective + ' ' + e.blockedURI)) })()"""

ap = argparse.ArgumentParser()
ap.add_argument('url'); ap.add_argument('out', nargs='+')
ap.add_argument('--w', type=int, default=390); ap.add_argument('--h', type=int, default=844)
ap.add_argument('--desktop', action='store_true')
ap.add_argument('--wait', type=float, default=3); ap.add_argument('--js', action='append', default=[])
ap.add_argument('--then', type=float, default=1.5); ap.add_argument('--port', type=int, default=9351)
a = ap.parse_args()
prof = tempfile.mkdtemp(prefix='popshot-')
ch = subprocess.Popen([CHROME, '--headless=new', '--remote-debugging-port=%d' % a.port, '--user-data-dir=' + prof,
                       '--no-first-run', '--hide-scrollbars', '--use-fake-device-for-media-capture', '--use-fake-ui-for-media-stream',
                       '--autoplay-policy=no-user-gesture-required', '--mute-audio', 'about:blank'],
                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    cdp.wait_for_devtools(a.port)
    t = cdp.new_tab(a.port)
    t.call('Page.enable'); t.call('Runtime.enable')
    t.call('Emulation.setDeviceMetricsOverride', width=a.w, height=a.h, deviceScaleFactor=2, mobile=not a.desktop)
    if not a.desktop:
        t.call('Emulation.setTouchEmulationEnabled', enabled=True)
    t.call('Page.addScriptToEvaluateOnNewDocument', source=ERRS)
    t.call('Page.navigate', url=a.url)
    time.sleep(a.wait)
    shots = list(a.out)
    def snap():
        p = shots.pop(0)
        d = t.call('Page.captureScreenshot', format='png')
        open(p, 'wb').write(base64.b64decode(d['data']))
        print('saved', p)
    snap()
    for js in a.js:
        r = t.eval(js)
        if r is not None: print('js →', r)
        time.sleep(a.then)
        if shots: snap()
    print('errors:', t.eval('window.__E'))
finally:
    ch.terminate(); shutil.rmtree(prof, ignore_errors=True)
