"""Parse the explicitly selected source; never silently activate a future snapshot."""
import argparse
from datetime import datetime, timezone, date
import hashlib
import json
from pathlib import Path
from rules_parser import parse

ROOT = Path(__file__).resolve().parents[1]

def selected_corpus(source, selection, as_of):
    date.fromisoformat(as_of)
    raw = (source/'comprehensive-rules.txt').read_bytes()
    provenance = json.loads((source/'provenance.json').read_text())
    digest = hashlib.sha256(raw).hexdigest()
    if digest != provenance['sha256'] or digest != selection['sourceSha256']:
        raise ValueError('Source identity changed; review and select the new snapshot explicitly')
    corpus, audit = parse(raw, provenance['url'], provenance['retrievedAt'], as_of)
    if selection['mode'] not in ('preview', 'effective'):
        raise ValueError('Choose preview or effective explicitly')
    if selection['mode'] == 'effective' and corpus['source']['effectiveStatus'] == 'future':
        raise ValueError('Future-effective rules cannot be activated. Preserve the existing release or explicitly select a labeled preview.')
    return corpus, audit

if __name__ == '__main__':
    p=argparse.ArgumentParser();p.add_argument('--as-of',default=datetime.now(timezone.utc).date().isoformat());a=p.parse_args()
    source=ROOT/'data-sources/rules'
    selection=json.loads((source/'selection.json').read_text())
    corpus,audit=selected_corpus(source,selection,a.as_of)
    out=ROOT/'public/data';out.mkdir(exist_ok=True)
    (out/'rules.json').write_text(json.dumps(corpus,ensure_ascii=False,separators=(',',':')))
    print(f"Rules: {len(corpus['documents'])} documents; {selection['mode']}; effective {corpus['source']['effectiveDate']}")
