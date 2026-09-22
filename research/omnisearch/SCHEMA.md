# Proposed document schema

The machine-readable proposal is `schema.json` (JSON Schema 2020-12). The actual
`data/corpus.json` conforms to that shape. The card dataset/schema is unchanged.

## Snapshot envelope

| Field | Meaning |
|---|---|
| `schemaVersion` | Serialization contract, currently 1 |
| `source.publisher`, `language` | Wizards of the Coast, English |
| `source.landingPage`, `url` | Official discovery page and exact downloaded TXT |
| `source.retrievedAt` | UTC timestamp of source capture |
| `source.effectiveDate`, `asOfDate`, `effectiveStatus` | Separate publication capture from legal-game effective date; this snapshot is **future** |
| `source.sha256`, `originalBytes` | Identity and integrity of the original bytes |
| `source.parserVersion` | Parser semantics; currently 1.0.1 |
| `documents` | Ordered section, rule/subrule and glossary records |

Use `(source.sha256, document.id)` as the durable citation key. Rule numbers and
glossary titles may change between releases; `cr:702.19b` is stable only within a
snapshot, not a promise of semantic identity forever. `effective` means the date
has arrived, not that no newer snapshot supersedes it. A future production update
policy must retain the in-force snapshot until a future-dated one takes effect.

## Document records

| Field | Example / purpose |
|---|---|
| `id` | `cr:702.19b` or `glossary:trample`; unique inside the snapshot |
| `kind` | `section`, `rule` or `glossary` |
| `key` | Original rule number or glossary heading |
| `title` | Search/display title; rule titles combine the number and its parent/section context |
| `text` | Authoritative source body with continuation/example lines retained |
| `parentId` | Immediate chapter/section/rule parent, or null for glossary/top-level chapter |
| `sectionId` | Containing section for navigation; null for glossary; sections identify themselves |
| `order` | Source sequence, independent of lexical ID sorting |
| `sourceLines` | Inclusive one-based span in the decoded original TXT |
| `references` | Extracted references that resolve within this snapshot |
| `unresolvedReferences` | Recognized reference tokens without an existing target, retained for audit |

Bodies are not generated summaries. Leading/trailing line whitespace and blank
separators are normalized; examples, symbols, punctuation and nonblank continuation
text are preserved. Rule titles are contextual **derived metadata**, not additional
Wizards-authored headings. Glossary titles and section titles are source headings.
Subrules such as `702.19b` have parent `cr:702.19`. Glossary IDs are normalized slugs;
any collision makes parsing fail rather than silently merging entries.

Cross-references are conservative syntax extraction, not semantic inference. Exact
standalone `See <glossary term>.` aliases are resolved. Ranges and natural-language
relationships are not fully expanded. Zero unresolved references means zero among
recognized tokens, **not** proof that every possible relationship was extracted.
No card-to-rule semantic links are generated in this study. Retain obsolete labels
present in glossary headings; do not silently present obsolete definitions as new
mechanics.

## Audit and transport

The parser verifies all body/glossary nonblank lines are accounted for, each body
round-trips to its source span, IDs are unique, and every parent exists. The table
of contents/preamble and credits are explicitly excluded from search and retained
in the original TXT. The glossary is the glossary **inside Comprehensive Rules**,
not the separate beginner keyword webpage.

`lean-rules.json` retains `id/kind/key/title/text` for transport experiments only.
It lacks navigation/provenance per-document metadata; do not ship it as the sole
citation artifact. The canonical schema plus its index costs only about 65–70 kB
more gzip than the lean experiment. Prefer the canonical corpus for a first V1.2.

`rules-index.json` is derived: version, document count, average weighted token
length, per-document lengths, and term → flattened `(document offset, frequency)`
postings. Offsets refer to the exact ordered corpus. Bind index and corpus hashes
in an eventual release manifest and cache them atomically. Research files are not
added to the current PWA cache, build, or UI.
