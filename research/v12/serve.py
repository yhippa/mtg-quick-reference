"""Serve unchanged dist plus development-only measurement endpoints."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from datetime import datetime, timezone
import argparse,json
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT/'dist'),**kw)
    def do_GET(self):
        path=self.path.split('?')[0]
        if path=='/__bench/config':
            value={'workerPath':'/'+str(next((ROOT/'dist/assets').glob('rules.worker-*.js')).relative_to(ROOT/'dist')),'cases':json.loads((ROOT/'research/omnisearch/evaluation.json').read_text())['cases']}
            body=json.dumps(value).encode();kind='application/json'
        elif path in ('/__bench/','/__bench/index.html','/__bench/benchmark.mjs','/__bench/card-search.mjs'):
            file=path.rsplit('/',1)[-1] or 'index.html'
            body=((ROOT/'research/omnisearch/data/card-search.mjs') if file=='card-search.mjs' else HERE/file).read_bytes();kind='text/html' if file.endswith('html') else 'text/javascript'
        else:return super().do_GET()
        self.send_response(200);self.send_header('Content-Type',kind);self.end_headers();self.wfile.write(body)
    def do_POST(self):
        if self.path!='/__bench/results':self.send_error(404);return
        n=int(self.headers.get('Content-Length','0'))
        if not 0<n<100000:self.send_error(400);return
        result=json.loads(self.rfile.read(n));stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        (HERE/'results'/f'browser-{stamp}.json').write_text(json.dumps(result,indent=2)+'\n')
        self.send_response(204);self.end_headers()
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=4373);p.add_argument('--host',default='127.0.0.1');a=p.parse_args()
    ThreadingHTTPServer((a.host,a.port),Handler).serve_forever()
