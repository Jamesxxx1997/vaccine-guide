#!/usr/bin/env python3
"""開發用伺服器：等同 http.server，但強制 no-cache。

為什麼存在：Chrome 對 localhost 的 index.html 會用快取且不革新（本專案實測：
改完檔重新整理仍拿到舊版，得靠 ?v= 查詢參數硬繞）。迭代期間用這支，
每次重新整理都拿最新版。用法：python3 tools/serve.py [port]
"""
import http.server, sys, functools

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8899
handler = functools.partial(NoCache, directory=".")
print(f"http://localhost:{port}/index.html （no-cache）")
http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
