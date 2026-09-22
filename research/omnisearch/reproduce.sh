#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
python3 research/omnisearch/parse_rules.py --as-of 2026-09-20
node research/omnisearch/prepare.mjs
python3 -m unittest discover -s research/omnisearch/tests
node --test research/omnisearch/tests/*.test.mjs
node research/omnisearch/evaluate.mjs
node --expose-gc research/omnisearch/production-context.mjs prebuilt > research/omnisearch/results/production-context-prebuilt.json
node --expose-gc research/omnisearch/production-context.mjs runtime > research/omnisearch/results/production-context-runtime.json
BENCH_ROUNDS=3 node --jitless --expose-gc research/omnisearch/bench_one.mjs split-prebuilt > research/omnisearch/results/stress-split-prebuilt.json
BENCH_ROUNDS=3 node --jitless --expose-gc research/omnisearch/bench_one.mjs split > research/omnisearch/results/stress-split.json
python3 research/omnisearch/summarize.py
python3 research/omnisearch/write_manifest.py
