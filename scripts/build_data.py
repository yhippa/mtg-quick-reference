"""Reduce MTGJSON AtomicCards to a deterministic, printing-independent reference."""
import argparse
import gzip
import json
from pathlib import Path
import urllib.request

SOURCE = 'https://mtgjson.com/api/v5/AtomicCards.json.gz'


def transform(source):
    cards = []
    for name, records in sorted(source['data'].items()):
        faces, seen, rulings = [], set(), set()
        for record in sorted(records, key=lambda r: r.get('side', 'a')):
            face = {key: str(record[field]) for key, field in (
                ('name', 'faceName'), ('mana', 'manaCost'), ('type', 'type'),
                ('text', 'text'), ('power', 'power'), ('toughness', 'toughness'),
                ('loyalty', 'loyalty'), ('defense', 'defense')) if field in record}
            face.setdefault('name', name)
            face.setdefault('type', '')
            face.setdefault('text', '')
            fingerprint = json.dumps(face, sort_keys=True)
            if fingerprint not in seen:
                faces.append(face)
                seen.add(fingerprint)
            for ruling in record.get('rulings', []):
                rulings.add((ruling.get('date', ''), ruling['text']))
        if faces:
            card = {'name': name, 'faces': faces, 'rulings': sorted(rulings)}
            ranks = [r['edhrecRank'] for r in records if r.get('edhrecRank')]
            if ranks:
                card['rank'] = min(ranks)
            cards.append(card)
    if not cards:
        raise ValueError('Source contains no cards; refusing to replace dataset')
    return {'schema': 1, 'updated': source['meta']['date'], 'source': 'MTGJSON', 'cards': cards}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path, help='Local AtomicCards.json or .json.gz')
    parser.add_argument('--output', type=Path, default=Path('public/data/cards.json'))
    args = parser.parse_args()
    if args.input:
        raw = args.input.read_bytes()
    else:
        request = urllib.request.Request(SOURCE, headers={'User-Agent': 'MTGQuickReference/1.0'})
        with urllib.request.urlopen(request, timeout=180) as response:
            raw = response.read()
    if raw[:2] == b'\x1f\x8b':
        raw = gzip.decompress(raw)
    result = transform(json.loads(raw))
    payload = json.dumps(result, ensure_ascii=False, separators=(',', ':')).encode()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temp = args.output.with_suffix('.tmp')
    temp.write_bytes(payload)
    temp.replace(args.output)
    stats = {'cards': len(result['cards']), 'updated': result['updated'], 'bytes': len(payload),
             'gzipBytes': len(gzip.compress(payload, mtime=0))}
    args.output.with_name('stats.json').write_text(json.dumps(stats, indent=2) + '\n')
    print(json.dumps(stats, indent=2))


if __name__ == '__main__':
    main()
