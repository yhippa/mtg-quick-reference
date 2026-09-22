import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildBM25 } from '../src/rules-search.ts';
import type { RulesCorpus, RulesRelease } from '../src/rules-types.ts';
const hash = (b: string | Buffer) => createHash('sha256').update(b).digest('hex');
const corpusBytes=readFileSync('public/data/rules.json');
const corpus: RulesCorpus=JSON.parse(corpusBytes.toString());
const selection=JSON.parse(readFileSync('data-sources/rules/selection.json','utf8'));
const index=JSON.stringify({corpusSha256:hash(corpusBytes),sourceSha256:corpus.source.sha256,index:buildBM25(corpus.documents)});
const cards=readFileSync('public/data/cards.json');
const release: RulesRelease={schemaVersion:1,mode:selection.mode,source:corpus.source,documents:corpus.documents.length,
  corpus:{url:'./data/rules.json',sha256:hash(corpusBytes)},index:{url:'./data/rules-index.json',sha256:hash(index)},
  cards:{sha256:hash(cards),updated:JSON.parse(cards.toString()).updated}};
writeFileSync('public/data/rules-index.json',index);
// Written last. Runtime verifies both artifacts before publishing readiness.
writeFileSync('public/data/rules-release.json',JSON.stringify(release));
