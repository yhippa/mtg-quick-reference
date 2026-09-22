"""Serve only the research folder; optional benchmark-result capture, no production writes."""
import argparse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import json
from pathlib import Path
from datetime import datetime, timezone
ROOT=Path(__file__).resolve().parent
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
    def do_POST(self):
        size=int(self.headers.get('Content-Length','0'))
        if self.path!='/save-results' or not 0<size<1000000:
            self.send_error(400);return
        try:
            result=json.loads(self.rfile.read(size))
            if not isinstance(result.get('runs'),list):raise ValueError()
            name='browser-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.json'
            (ROOT/'results'/name).write_text(json.dumps(result,indent=2)+'\n')
        except (ValueError,TypeError):self.send_error(400);return
        self.send_response(201);self.end_headers();self.wfile.write(b'saved')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=4196);p.add_argument('--host',default='127.0.0.1');a=p.parse_args()
    print(f'Research benchmark: http://{a.host}:{a.port}',flush=True)
    ThreadingHTTPServer((a.host,a.port),Handler).serve_forever()
