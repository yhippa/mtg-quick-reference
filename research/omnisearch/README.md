> V1.2 promotion note: this report records the original study. The parser and BM25
> implementation now live in `scripts/rules_parser.py` and `src/rules-search.ts`;
> research entry points reuse them. Later Android captures are retained in results.
> See `../../docs/V1.2.md` for implementation measurements and verification.

# Omnisearch feasibility study

**Recommendation:** retain the existing card-name index; use a separate, prebuilt
BM25-style index for rule/glossary documents, with explicit rule-number and exact
name/title routing. Reuse the already-loaded card index rather than constructing
it again. Build/load rules in a worker or after card search becomes ready.
Do not ship unrestricted natural-language rules-question search on the strength
of this experiment: prose and colloquial retrieval still miss important rules.

Everything here is research-only. No production UI, source, package manifest,
card dataset, service worker, or deployment workflow was modified. A pre-existing
untracked research draft was validated and extended; its source was independently
redownloaded and checksum-verified, and its ranking judgments were preserved.

## Authoritative source and date

Source: [Wizards' official rules page](https://magic.wizards.com/en/rules), which
links [this Comprehensive Rules TXT](https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.txt).
The glossary is the final glossary **inside that authoritative document**.

**Important: its effective date is September 25, 2026, later than the study's
September 20 as-of date.** This is the latest *published/linked* snapshot, not a
claim that it is already in force. A currently-effective historical snapshot was
not substituted or guessed. Future production ingestion must explicitly handle
this distinction. Retrieval timestamps are UTC and may show September 21 while
local study time in America/New_York is September 20.

Original SHA-256:
`8d860e451f20f38865b725b42d82feb714c725373dd8f3b32b8652b3eeb070ca`.
See `source/provenance.json`, `source/rules-page.html`, and
`results/source-verification.json`. Full source bytes/credits are retained.
The downloader follows the actual official TXT link and refuses unexpected hosts.

## Parsing and proposed schema

See [SCHEMA.md](SCHEMA.md) and [schema.json](schema.json). The canonical corpus is
[data/corpus.json](data/corpus.json). Each document carries a kind, rule number or
glossary key, title, body, parent/section, source order, inclusive original line
span, and resolvable/unresolved cross-references. Publisher, effective date,
retrieval time, source URL, original hash and parser version live at snapshot level.
Citations should bind both snapshot hash and document ID; rule numbers are not
immutable across editions. Rule titles include derived context; bodies preserve
the original wording, examples and continuation lines.

| Parsed material | Count |
|---|---:|
| Numbered rules/subrules | 3,165 |
| Chapters/section headings | 156 |
| Glossary entries | 741 |
| Total documents | 4,062 |
| Accounted nonblank body/glossary lines | 5,123 / 5,123 |
| Bodies checked against their source span | 4,062 / 4,062 |
| Recognized references without a target | 0 |

The TOC/preamble and credits are excluded from search, not lost. Parent existence
and unique IDs are validated. The draft reference recognizer missed numbers next
to commas; parser 1.0.1 fixes that and adds regression coverage. Reference extraction
remains conservative: zero unresolved links does not establish that all ranges,
implicit references or semantic relationships have been discovered.

## Actual corpus and index sizes

Exact bytes, including compression estimates, are in [sizes.json](results/sizes.json).
Gzip uses Node/zlib's default level; Brotli uses Node's default. Each file is
compressed independently. These are artifact sizes, not observed CDN transfers.

| Artifact | Raw bytes | Gzip bytes | Brotli bytes |
|---|---:|---:|---:|
| Original Wizards TXT | 977,752 | 240,073 | 174,897 |
| Canonical parsed corpus | 1,819,470 | 356,051 | 234,280 |
| Lean text experiment | 1,306,754 | 286,029 | 198,276 |
| Separate rules index | 628,076 | 210,641 | 146,118 |
| Mixed card/rules index | 1,670,660 | 557,106 | 394,104 |
| Research card-name projection | 4,275,111 | 786,237 | 577,755 |

Rules vocabulary: **5,126 terms / 83,348 document-term postings**. Mixed vocabulary:
**24,421 terms / 159,696 postings**. Card input is the existing **35,282-card**
MTGJSON snapshot dated September 19.

Canonical corpus plus prebuilt rules index adds **566,692 bytes gzip** (~553 KiB),
about **8.4%** of the existing 6,732,474-byte compressed card dataset. Raw cached
files total **2,447,546 bytes**. Lean text plus index is 496,670 bytes gzip, but
omits per-document references/navigation/provenance metadata; the extra 70,022
bytes for the canonical format is a reasonable first implementation tradeoff.

Do **not** add the research card projection to the production payload. It exists
only to run isolated comparisons; production already has card names. The current
app's 29,228,731-byte data artifact stays untouched. A 566,692-byte additional
transfer alone takes ~0.91 s at 5 Mbit/s or ~4.53 s at 1 Mbit/s, excluding latency
and processing. Those are arithmetic bandwidth estimates, not phone measurements.

## Index experiments

All engines use the same ordered card/rule inputs. No external search dependency
was added. Normalization is the transpiled existing card search; prose is tokenized
with a small fixed stop-word list, no stemming, synonyms, embeddings or answers.
BM25-style scoring uses k1=1.2, b=0.75, title/alias frequency weight 3, and a squared
query-term-coverage multiplier. The exact implementation is in `engine.mjs`.

1. **Linear:** existing card names plus a scan of pre-tokenized rule sets; exact
   number/title routing and all-query-token matching.
2. **Unified:** one mixed BM25 index, no direct-lookup routing. This is the simplest
   mixed baseline, not an optimized universal search product.
3. **Unified + routing:** mixed BM25 plus the same direct lookup and card-prefix
   policy as the split model; rule retrieval filters to rule documents but retains
   mixed-corpus IDF statistics.
4. **Split:** current card name index plus rules-only BM25 and routing.
5. **Split, prebuilt:** identical ranking to Split; serialize the rules index at
   build time and parse it at load rather than tokenize on the device.

Routing prioritizes explicit rule IDs, exact card names/face aliases, exact glossary
and section titles, then a small number of card-prefix matches and rule relevance.
Exact card/glossary ambiguity remains visible; rankings are not interpreted as a
ruling. Matched prose is a retrieval destination, not a generated answer.

## Ranking evaluation

The **66-case**, author-written relevance set is in `evaluation.json`; its hash is
frozen in `results/evaluation-sha256.txt`. It has 22 development-labelled cases and
44 evaluation-labelled cases. These labels are **not an independent blind holdout**:
this is a small inherited hand-curated set, not judge-reviewed user logs. No
post-result synonym/weight tuning was done here. Treat results as comparative
engineering evidence, not a claim of general question-answer accuracy.

Grades: 3 = primary destination, 1 = useful context, 0 = unjudged/not counted.
Hit@k requires at least one grade-3 destination. MRR@10 uses the first grade-3 hit;
nDCG@5 uses graded relevance. Primary recall measures the fraction of grade-3 destinations retrieved in the
top five (important for ambiguity and multi-rule questions).

| Engine | Hit@1 | Hit@5 | MRR@10 | nDCG@5 |
|---|---:|---:|---:|---:|
| Linear | 60.6% | 75.8% | .664 | .682 |
| Unified | 33.3% | 66.7% | .458 | .482 |
| Unified + routing | 62.1% | 84.8% | .706 | .724 |
| Split | 62.1% | 83.3% | .700 | .716 |
| Split, prebuilt | 62.1% | 83.3% | .700 | .716 |

Both routed BM25 choices score **84.1% Hit@5 on the 44 evaluation-labelled cases**.
Unified+routing wins just **one** additional primary hit over Split across all 66
queries (`mana ability uses stack`). A descriptive paired bootstrap places the
Hit@5 difference at 0–4.55 percentage points; this is not convincing evidence to
pay for a larger unified index. Split is recommended for size, isolation and
preservation of current card search, **not because it won every ranking metric**.

For Split, Hit@5 is 100% on the 8 exact-card, 6 representative card-prefix, 8 rule-ID,
12 glossary and 8 ambiguous queries; **65% on 20 prose queries and 0% on 4 colloquial
queries**. Prose Hit@1 is only **15%**. The combined overall score hides this weakness.
Plain Unified finds only 3/6 prefix targets and 5/8 explicit rule IDs in its top five.

Examples of Split misses: `creature zero toughness indestructible`, `trample
deathtouch`, `sacrifice indestructible`, `replacement effects choose order`,
`fizzle`, `when does damage wear off`, and `can I respond to paying costs`.
These often require multiple rules or vocabulary absent from the query. The
judgments also name useful destinations rather than proving a complete interaction
answer. Grade-0 results may include relevant material omitted by the author;
future evaluation needs independent adjudication and expanded judgments.

All ranked top-10 results and misses are saved as `results/ranking-*.json` and
`results/experiments.json`, including input hashes. No misses were removed.

## Phone-relevant performance evidence

**No physical Android device was available.** Real measurements below are from an
Apple M1 Pro, Node 24.16.0 and the desktop Chromium 153 in-app browser. They are
not Android timings, and a phone-sized viewport was not used as a substitute.

Node measurements use three fresh processes per mode, a first pass of 66 queries,
then ten repetitions (660 warm queries/process). Memory is post-GC heap growth
from an empty process and includes the research name projection/index plus rules;
it is not incremental production-app memory. Desktop shared-system scheduling
and warm OS file cache are not controlled.

| Engine | Median ready | Warm query p95 | Post-GC heap growth |
|---|---:|---:|---:|
| Linear | 178 ms | 4.38 ms | 30.90 MB |
| Unified | 221 ms | 0.57 ms | 22.19 MB |
| Unified + routing | 298 ms | 4.07 ms | 33.92 MB |
| Split | 195 ms | 4.09 ms | 27.13 MB |
| Split, prebuilt | 122 ms | 4.04 ms | 26.44 MB |

A separate **production-context** process loads the full current card dataset and
existing name index first. Adding the canonical rules corpus and prebuilt index
then takes **14 ms** for file-read/parse, adds **5.48 MB heap**, and brings the total
heap to **72.05 MB** in that Node process. It deliberately reuses the existing
card index. This excludes renderer/browser memory and is not a peak-RSS claim.
See `results/production-context-*.json`.

Browser measurements run each engine in a fresh frame, keep the page visible,
measure JSON parse/build separately, and schedule each query as a separate task.
Each run has 66 first-use and 198 warm queries. The final run is
`results/browser-20260921T024029Z.json`; the earlier pilot is retained too.

| Browser mode | JSON parse | Index build | Warm p95 |
|---|---:|---:|---:|
| Linear main thread | 15.4 ms | 139.7 ms | 4.0 ms |
| Unified main thread | 10.6 ms | 150.7 ms | 1.4 ms |
| Unified+routing main thread | 10.5 ms | 217.3 ms | 3.8 ms |
| Split main thread | 10.8 ms | 132.1 ms | 3.9 ms |
| Split/prebuilt main thread | 12.8 ms | 76.8 ms | 3.9 ms |
| Split/prebuilt worker, internal | 16.4 ms | 82.2 ms | 3.9 ms |
| Split/prebuilt worker, round trip | 16.1 ms | 80.4 ms | 3.6 ms |

The round trip includes posting the query and cloning top-10 ID/title/kind results
back to the main thread, not rendering result cards. Minor differences between
runs are noise; the worker is recommended for isolation, not as a speedup claim.
All 198 warm queries in each browser mode stayed under 16.7 ms on this machine.
But **every cold build exceeded the 50 ms long-task budget**, including prebuilt
mode because it still rebuilt card names in this standalone comparison. Reuse
that existing index and keep additional work off the input thread on phones.

A measured Node `--jitless` sensitivity run (3 × 66 warm queries) raises Split query
p95 to **34.3 ms**, and prebuilt mode to **45.4 ms**, with outliers above 100 ms.
This removes JIT optimizations; it is **not a calibrated slow-phone or CPU-throttle
simulation**. It shows that desktop warm timings alone do not establish phone TTI.
No-JIT prebuilt readiness was 203 ms versus 448 ms runtime build. Results are in
`results/stress-*.json`. Browser heap counters are retained as diagnostics only:
GC is uncontrolled and they may include other contexts, so do not compare those
as isolated mode memory footprints.

## Run on the actual Android phone

The standalone page is `index.html` in this folder; it does not import the app UI.

```sh
python3 research/omnisearch/serve.py --host 0.0.0.0 --port 4196
```

On the same Wi-Fi network, open `http://YOUR-COMPUTER-LAN-IP:4196/` in Chrome on the
phone. Run once for a pilot and twice more with the tab foregrounded. Download the
JSON after each run; the local server also saves it under `results/browser-*.json`.
Record phone model, Android/Chrome version, battery/power-saving state, and whether
the device is warm. The server exposes only this research folder. Stop it afterward
with Ctrl-C. This harness needs neither a PWA installation nor HTTPS; it is not
an offline-install test. Fetch times over local Wi-Fi/raw JSON are not cellular
or production-compression measurements.

Before selecting V1.2 architecture, require target-phone evidence for warm query
p95, cold additional initialization, >50 ms query outliers, worker message latency,
and total app memory. Suggested decision budgets: query p95 under 50 ms and no
additional >50 ms input-thread initialization task. Budget values are proposals;
this study has not passed those gates on Android.

## Reproduce and audit

Requires the existing Node/npm development dependencies and Python standard library.
No new production dependency. From the repository root:

```sh
sh research/omnisearch/reproduce.sh
```

That uses the pinned official source, validates parsing, builds indexes, runs five
research tests, benchmarks/ranks five engines, measures production-context memory
and runs no-JIT sensitivity checks. Browser measurements are a separate manual
harness run and are not overwritten by that command. Re-running changes timing
results; ranking artifacts should reproduce exactly for the frozen inputs.

To fetch a new official snapshot without overwriting this study:

```sh
python3 research/omnisearch/fetch_source.py --output /tmp/mtg-rules-new
```

Inspect effective date and changes before replacing the pinned source. Do not
regenerate `evaluation.json` merely to make a new source pass; review rule renumbers
and judgments explicitly. The JSON Schema is a proposal plus parser structural
checks; a full third-party JSON Schema validator was not installed for this study.
Production tests (30) and production build were also rerun. Research files remain
outside `public/` and `src/`, so Vite and the generated service worker do not ship
them. See `results/manifest.json` for research input hashes.

## Next decision

Proceed with explicit rule-number, glossary/keyword-title and card-name retrieval
using separate indexes, authoritative snapshot citations, and version-safe links.
Before broad natural-language ranking, collect independent game-session queries
and multi-rule relevance judgments, then compare lightweight vocabulary expansion
and ranking changes against that new set. Do not infer card interactions or present
retrieval scores as authoritative answers. Do not couple future-dated rules to the
live card snapshot without an explicit effective-date policy.
