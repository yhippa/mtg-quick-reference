"""Produce derived comparison tables from saved experiment outputs (no reranking)."""
import json,statistics,random
from pathlib import Path
ROOT=Path(__file__).resolve().parent
report=json.loads((ROOT/'results/experiments.json').read_text())
sizes=json.loads((ROOT/'results/sizes.json').read_text())['sizes']
summary={'corpusCounts':json.loads((ROOT/'results/parser-audit.json').read_text())['counts'],'models':{}}
for mode,runs in report['runs'].items():
    summary['models'][mode]={'ranking':report['metrics'][mode],
       'medianReadyMs':statistics.median(r['timing']['readyMs'] for r in runs),
       'medianSearchP95Ms':statistics.median(r['timing']['warm']['p95'] for r in runs),
       'medianHeapBytes':statistics.median(r['memory']['heapDeltaBytes'] for r in runs)}
summary['incrementalShipping']={
 'canonicalPlusPrebuilt':sum(sizes[p]['gzipBytes'] for p in ['data/corpus.json','data/rules-index.json']),
 'leanPlusPrebuilt':sum(sizes[p]['gzipBytes'] for p in ['data/lean-rules.json','data/rules-index.json']),
 'note':'Sum of separately gzip-compressed files. Card-name projection is not additive to production; reuse existing card data/index.'}
a=json.loads((ROOT/'results/ranking-split.json').read_text());b=json.loads((ROOT/'results/ranking-unified-routed.json').read_text())
def hit(c):return any(c['relevance'].get(r['id'])==3 for r in c['results'][:5])
diffs=[int(hit(cb))-int(hit(ca)) for ca,cb in zip(a,b)]
rng=random.Random(20260920);samples=sorted(sum(rng.choices(diffs,k=len(diffs)))/len(diffs) for _ in range(10000))
summary['pairedBootstrap']={'metric':'unified-routed minus split Hit@5','difference':sum(diffs)/len(diffs),'percentile95':[samples[249],samples[9749]],'note':'Descriptive resampling of a small author-written set; not evidence of general population performance.'}
(ROOT/'results/summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k!='models'},indent=2))
