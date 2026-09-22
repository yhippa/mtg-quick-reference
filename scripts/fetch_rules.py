"""Download only the TXT actually linked by Wizards, into a new snapshot directory."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlparse
from rules_parser import Links, PAGE, parse

def download(url):
    with urlopen(Request(url,headers={'User-Agent':'MTGQuickReferenceResearch/1.0'}),timeout=60) as r:
        if urlparse(r.url).hostname not in ('magic.wizards.com','www.magic.wizards.com','media.wizards.com'):
            raise ValueError('Unexpected source redirect; inspect manually')
        return r.read()

def main():
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);p.add_argument('--as-of',default=datetime.now(timezone.utc).date().isoformat());a=p.parse_args()
    if a.output.exists() and any(a.output.iterdir()):raise SystemExit('Choose an empty directory to preserve earlier snapshots.')
    html=download(PAGE);links=Links();links.feed(html.decode('utf8'))
    urls=sorted(set(links.links))
    if len(urls)!=1:raise SystemExit(f'Expected one official TXT link, found {urls}')
    raw=download(urls[0]);corpus,audit=parse(raw,urls[0],datetime.now(timezone.utc).isoformat(),a.as_of)
    a.output.mkdir(parents=True,exist_ok=True)
    (a.output/'rules-page.html').write_bytes(html);(a.output/'comprehensive-rules.txt').write_bytes(raw)
    (a.output/'provenance.json').write_text(json.dumps(corpus['source'],indent=2)+'\n')
    print(json.dumps({'source':corpus['source'],'audit':audit},indent=2))

if __name__ == "__main__": main()
