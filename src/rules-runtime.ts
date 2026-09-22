import { createRuleDetails } from './rule-family.ts';
import { createRulesSearch } from './rules-search.ts';
import type { BM25Index, RulesCorpus, RulesRelease } from './rules-types.ts';
export async function sha256(bytes: ArrayBuffer) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function hydrateRules(release:RulesRelease, corpusBytes:ArrayBuffer, indexBytes:ArrayBuffer, asOf=new Date().toISOString().slice(0,10)) {
  if(release.schemaVersion!==1 || !['preview','effective'].includes(release.mode))throw Error('Unsupported rules release');
  if(release.mode==='effective'&&release.source.effectiveDate>asOf)throw Error('Rules not yet effective');
  if(await sha256(corpusBytes)!==release.corpus.sha256 || await sha256(indexBytes)!==release.index.sha256)throw Error('Rules snapshot integrity mismatch');
  const corpus:RulesCorpus=JSON.parse(new TextDecoder().decode(corpusBytes));
  const stored:{corpusSha256:string;sourceSha256:string;index:BM25Index}=JSON.parse(new TextDecoder().decode(indexBytes));
  if(corpus.schemaVersion!==1 || stored.index.version!==1 || stored.corpusSha256!==release.corpus.sha256 || stored.sourceSha256!==release.source.sha256 || corpus.source.sha256!==release.source.sha256 || JSON.stringify(corpus.source)!==JSON.stringify(release.source) || stored.index.n!==corpus.documents.length || stored.index.n!==release.documents || stored.index.lengths.length!==release.documents)throw Error('Incompatible corpus/index pair');
  return {search:createRulesSearch(corpus.documents,stored.index),detail:createRuleDetails(corpus.documents)};
}
