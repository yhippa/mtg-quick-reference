# V1.2.1 — Rule family reading

## Delivered UX

| Entry | Before | Now |
|---|---|---|
| Search `banding` → 702.22 | Heading and child links; open each child separately | One continuous family with all 12 direct children |
| Banding glossary → explicit 702.22 reference | Another child-selection step | Immediately readable Banding family |
| Exact `702.22a` | Isolated child | Same exact URL/document identity, surrounding family, focused and subtly highlighted child |
| `601` Casting Spells | Links to direct children | 601.1–601.8 read together; a single link on nested containers opens their own direct family |

Banding has 12 children in this snapshot: a–k and m. There is no l. No missing text was invented. Rule numbers remain individually linked; parent navigation goes above the displayed family. Redundant links to already displayed children are removed. Validated inline cross-references remain intact.

## Reading boundary

`src/rule-family.ts` builds maps from existing document IDs and parent IDs and sorts children by source order. A container is a reading family only when every direct child is a rule with sentence punctuation followed by a sentence boundary. This is a conservative prose-versus-label heuristic, not semantic inference or a numbering-depth rule. No mechanic IDs are special-cased.

A requested container opens its own direct family. A requested leaf joins its immediate parent's family when that group qualifies. Mixed/ambiguous groups retain the old view. Chapters and 702's catalog of mechanic headings stay navigation. Examples of fallback groups include 113, 117, 205, 701, 702, 703, 704 and 716.2; some mix prose with labels or colon-led list introductions. This deliberately does not recursively flatten all descendants. For example, 601.2 opens its nine direct children while 601 contains its eight direct rules.

The response retains `document` as the exact requested document, plus optional presentation-only `family` data. There is one existing detail request/response per navigation, not one request per child. No canonical documents are merged. Bodies use original text and each document's own validated references. Source disclosure includes every displayed source span and the requested document ID.

## Search experiment and decision

Production search is unchanged. All 66 frozen top-ten result lists match the validated split/prebuilt baseline exactly. Hit@1 62.12%, Hit@5 83.33%, MRR@10 0.699657, nDCG@5 0.715994; no metric differences.

`evaluate-collapse.ts` experimentally removes direct children only when the query exactly matches the displayed family heading and that parent is already in the results. Exact numbers and distinctive phrases are not collapsed. The experiment changes 13/66 top-ten lists and produces no DCG@5 regressions. Full before/after IDs are in `collapse-evaluation.json`.

Not shipped: the frozen judgments grade granular destinations, not the relative usefulness of a parent family versus a child-focused family. For Banding, collapse promotes glossary and distinct related rules 802.3b and 508.1e, but removes precise child entry points. Those replacements are related, not errors; whether they improve the list is ambiguous. This release solves the reading problem without changing validated retrieval. No ranking-regression claim is made for the experiment.

## Navigation and verification

Verified in the actual production build in the in-app browser at 375×812:

- Search Banding → glossary → 702.22: all 12 children, compact separators, no horizontal overflow.
- Back returns to the glossary, then restores query `banding` and the selected glossary result.
- Exact search 702.22a preserves its snapshot+child URL, highlights it and focuses it about 16 px below the viewport top.
- In-family navigation to 702.22j → explicit 510.1c reference opens its family; Back restores 702.22j, focus and scroll position.
- New search works; 601 displays eight direct children; 601.2 opens nine nested children.
- A deliberately mismatched snapshot URL still shows “Different rules snapshot,” without resolving in this edition.
- Stopped the preview server, cold-reloaded the app, then searched Banding → glossary → family → exact child successfully from the service-worker cache.

Automated checks: 38 Node production tests + 5 Python production tests; 2 Node research tests + 3 Python research tests. All 48 pass. Five new focused tests cover family composition/provenance, child identity/highlighting, glossary references, Casting Spells/nested/fallback behavior, and renumbered/shuffled synthetic hierarchy. The existing offline test now checks a complete child-focused family. Existing card, recents, stale-worker-response, snapshot, search and preview/effective tests all still pass. Back and real browser snapshot mismatch were checked through the UI as listed above.

Full production build passes; offline snapshot contains 20 verified files. Full frozen evaluation rerun across linear, unified, unified-routed, split and split-prebuilt passes. Results are saved in `experiments.json`. Physical-phone and assistive-technology checks remain unperformed; the mobile check is a desktop browser viewport, not a hardware benchmark.

## Performance

See `performance.json`, `production.json` and `baseline.json` for exact measurements/environment. Timings are Node on this Mac, not physical-phone timings; HTML generation excludes browser layout.

- Rules corpus: **1,819,470 bytes**, index **628,250 bytes**, cards **29,228,731 bytes** — byte-identical to baseline.
- Main JS: 18,580 → 19,717 bytes (+388 gzip bytes).
- CSS: 9,151 → 10,008 bytes (+165 gzip bytes).
- Worker JS: 3,721 → 4,161 bytes (+181 gzip bytes).
- Total additional compressed code/styles: **734 bytes**.
- Recorded rules hydration baseline 18.62 ms; new run 20.83 ms. These individual runs are noisy, not a statistically established regression. Worker initialization still builds the same ID/parent maps and hydrates the same prebuilt index; family content is assembled only on detail requests.
- Warm rules-search p95: 0.36475 → 0.36542 ms; card-search p95: 3.373 → 3.534 ms. Search implementation did not change.
- One Banding response: 6,993 JSON bytes (child-focused: 7,055). 601: 8,273; nested 601.2: 12,548. These are in-memory worker messages, not additional network assets.
- Across 300 warm iterations, family lookup p95 ≤0.010 ms, structured-clone p95 ≤0.044 ms, HTML generation p95 ≤0.109 ms for these families. Clone timing approximates serialization, not worker scheduling.

## Scope preserved

Parser, corpus schema and IDs, source text/spans, cross-references, source snapshot, card behavior/search/recents, split/prebuilt retrieval, worker lifecycle, and offline integrity architecture are unchanged. The installed release stays explicitly `preview`. Selecting a valid `effective` release still removes PREVIEW labels/warnings and retains source/effective date information. No automatic date-based promotion was added. No generated explanations, semantic inference, tabs, tree browser, favorites, new data sources or new card functionality were added.
