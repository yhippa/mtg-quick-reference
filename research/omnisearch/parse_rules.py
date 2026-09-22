"""Research CLI using the production-promoted, loss-audited parser."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from rules_parser import *
ROOT = Path(__file__).resolve().parent

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--as-of',default='2026-09-20')
    args=parser.parse_args()
    links=Links();links.feed((ROOT/'source/rules-page.html').read_text())
    urls=sorted(set(links.links))
    if len(urls)!=1: raise ValueError(f'Expected one official TXT download, got {urls}')
    source=ROOT/'source/comprehensive-rules.txt'
    provenance_path=ROOT/'source/provenance.json'
    if provenance_path.exists():
        provenance=json.loads(provenance_path.read_text())
        retrieved=provenance['retrievedAt']
        if provenance['sha256'] != hashlib.sha256(source.read_bytes()).hexdigest():
            raise ValueError('Source checksum changed; explicitly refresh provenance')
    else:
        retrieved=datetime.now(timezone.utc).isoformat()
    corpus,audit=parse(source.read_bytes(),urls[0],retrieved,args.as_of)
    provenance_path.write_text(json.dumps(corpus['source'],indent=2)+'\n')
    (ROOT/'data/corpus.json').write_text(json.dumps(corpus,ensure_ascii=False,separators=(',',':')))
    (ROOT/'results/parser-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
    print(json.dumps({'source':corpus['source'],'audit':audit},indent=2))

if __name__=='__main__':main()
