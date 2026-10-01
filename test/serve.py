#!/usr/bin/env python3
"""pop_demo ローカルテスト用サーバ（本番と同じ並びで配る）

    /            … 本番のぽっと通話（既定 ~/Downloads/webrtc-call の作業ツリー）
    /pop_demo/   … この repo（お試し版）

本番では potalk.app/ と potalk.app/pop_demo/ が同じオリジンなので、保存の引き継ぎや
声のモデル（../models/）も同じ条件で試せる。

どちらの index.html も配るときに appId を書き換えて本番のロビーから隔離し、
Nostr への直 publish も止める（ファイル自体は書き換えない）。

    python3 test/serve.py                 # http://localhost:8000/ と /pop_demo/（appId は …-dev）
    python3 test/serve.py --tag t1        # 別の隔離空間
    python3 test/serve.py --prod          # 書き換えなし＝本番と同じロビーに出る（最終確認用）

ポートは 8000 固定：TURN Worker が http://localhost:8000 しか許可していない。
"""

import argparse
import functools
import http.server
import os
import socketserver
import sys
import urllib.parse

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPSTREAM = os.path.expanduser('~/Downloads/webrtc-call')
APP_ID_SRC = "appId: 'kuramo-webrtc-call'"
NOSTR_SRC = 'const NOSTR_RELAYS = TRYSTERO_BASE.relayConfig.urls'
NOSTR_DST = 'const NOSTR_RELAYS = []   /* テスト中は公開リレーへ流さない */'
PREFIX = '/pop_demo'


class Handler(http.server.SimpleHTTPRequestHandler):
    tag = 'dev'
    upstream = UPSTREAM

    def translate_path(self, path):
        p = path.split('?', 1)[0].split('#', 1)[0]
        if p == PREFIX or p.startswith(PREFIX + '/'):
            return self._join(HERE, p[len(PREFIX):])
        return self._join(self.upstream, p)

    @staticmethod
    def _join(root, rel):
        parts = [x for x in urllib.parse.unquote(rel).split('/') if x and x not in ('.', '..')]
        return os.path.join(root, *parts)

    def send_head(self):
        p = self.path.split('?', 1)[0]
        if p == PREFIX:
            self.send_response(301)
            self.send_header('Location', PREFIX + '/')
            self.end_headers()
            return None
        return super().send_head()

    def _patched(self, path):
        with open(path, 'rb') as f:
            body = f.read()
        if not self.tag:
            return body
        for src, dst in ((APP_ID_SRC, APP_ID_SRC.replace('kuramo-webrtc-call', 'kuramo-webrtc-call-' + self.tag)),
                         (NOSTR_SRC, NOSTR_DST)):
            if src.encode() not in body:
                self.send_error(500, 'not found in %s: %s' % (path, src))
                return None
            body = body.replace(src.encode(), dst.encode())
        return body

    def do_GET(self):
        p = self.path.split('?', 1)[0]
        if p in ('/', '/index.html', PREFIX + '/', PREFIX + '/index.html'):
            body = self._patched(os.path.join(self.translate_path(p.rsplit('index.html', 1)[0]), 'index.html'))
            if body is None:
                return
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--port', type=int, default=8000)
    ap.add_argument('--tag', default='dev')
    ap.add_argument('--prod', action='store_true')
    ap.add_argument('--upstream', default=UPSTREAM, help='本番側として / に配るディレクトリ')
    a = ap.parse_args()
    Handler.tag = '' if a.prod else a.tag
    Handler.upstream = a.upstream
    with Server(('127.0.0.1', a.port), Handler) as httpd:
        print('http://localhost:%d/  と  http://localhost:%d%s/   (%s)'
              % (a.port, a.port, PREFIX, '本番と同じ appId' if a.prod else 'appId …-' + a.tag))
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    sys.exit(main())
