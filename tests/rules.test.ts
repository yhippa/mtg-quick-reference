import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeIndex,search} from '../src/search.ts';
import {createRulesSearch,buildBM25} from '../src/rules-search.ts';
import {mergeResults,readRoute,referenceUrl,secondaryRuleResults} from '../src/omnisearch.ts';
import {hydrateRules} from '../src/rules-runtime.ts';
import {renderRule,ruleResultLabel,rulesStatusLabel} from '../src/rules-detail.ts';
import {RulesClient} from '../src/rules-client.ts';
import {createEngine} from '../research/omnisearch/engine.mjs';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const corpus=read('public/data/rules.json'),stored=read('public/data/rules-index.json'),release=read('public/data/rules-release.json');
const cards=read('public/data/cards.json').cards,index=makeIndex(cards),rules=createRulesSearch(corpus.documents,stored.index);
const bytes=(p:string)=>new Uint8Array(readFileSync(p)).buffer;
const resultIds=(q:string)=>mergeResults(q,search(index,q),index,rules(q)).slice(0,10).map(h=>h.kind==='card'?'card:'+encodeURIComponent(cards[h.cardId].name):h.id);
test('promoted rules index is byte-for-byte equivalent to the research algorithm',()=>assert.equal(JSON.stringify(stored.index),JSON.stringify(buildBM25(corpus.documents))));
test('all frozen queries retain research split/prebuilt top ten ranking',()=>{
  const baseline=createEngine('split',corpus.documents,cards.map((c:any)=>({id:'card:'+encodeURIComponent(c.name),kind:'card',title:c.name,aliases:c.faces.map((f:any)=>f.name),rank:c.rank??999999})),stored.index);
  for(const c of read('research/omnisearch/evaluation.json').cases)assert.deepEqual(resultIds(c.query),baseline.search(c.query).map((r:{id:string})=>r.id),c.query);
  // Also compare saved rankings while using the original card snapshot. Card refreshes
  // may change popularity ties; still compare both routers on identical fresh inputs.
  if(release.cards.sha256==='585af746735f9bf559386050103a1234dde334538755339e2c7cb9df9fb028d8')
    for(const c of read('research/omnisearch/results/ranking-split-prebuilt.json'))assert.deepEqual(resultIds(c.query),c.results.map((r:{id:string})=>r.id),c.query);
});
test('representative intent routing preserves cards and explicit rules',()=>{
  for(const [q,id] of [['sol ring','card:Sol%20Ring'],['blood moon','card:Blood%20Moon'],['ward','glossary:ward'],['deathtouch','glossary:deathtouch'],['dies','glossary:dies'],['priority','glossary:priority'],['702.19','cr:702.19']])assert.equal(resultIds(q)[0],id,q);
  assert.ok(resultIds('sheold').some(id=>id.includes('Sheoldred')));
  assert.ok(resultIds('layers').some(id=>id.startsWith('cr:613')||id==='glossary:layer'));
  assert.ok(resultIds('protection').includes('glossary:protection'));
  assert.ok(resultIds('who gets priority after a spell resolves').length);
});
test('rules hydration rejects corrupt, mismatched and premature effective releases',async()=>{
  const c=bytes('public/data/rules.json'),i=bytes('public/data/rules-index.json');
  await hydrateRules(release,c,i);
  await assert.rejects(hydrateRules(release,c,c),/integrity/);
  await assert.rejects(hydrateRules({...release,documents:1},c,i),/Incompatible/);
  await assert.rejects(hydrateRules({...release,mode:'effective'},c,i,'2026-09-20'),/not yet effective/);
});
test('rule/glossary rendering retains text, snapshot links, preview and children',async()=>{
  const runtime=await hydrateRules(release,bytes('public/data/rules.json'),bytes('public/data/rules-index.json'));
  for(const id of ['glossary:trample','cr:702.19','cr:702.19b']){
    const detail=runtime.detail(id)!;const html=renderRule(detail,release);
    assert.ok(html.includes('rule-title'));assert.equal(html.includes('PREVIEW'),release.mode==='preview');assert.ok(html.includes(release.source.sha256));
    for(const ref of detail.references)assert.ok(html.includes(encodeURIComponent(ref.id)));
    assert.deepEqual(readRoute(referenceUrl(release.source.sha256,id)),{kind:'rule',snapshot:release.source.sha256,id});
  }
  assert.equal(runtime.detail('unknown'),null);
});
test('pending worker keeps latest query and discards stale results/details without another card index',()=>{
  const sent:any[]=[];const worker:any={postMessage:(m:any)=>sent.push(m)};
  let changes=0,details=0;const client=new RulesClient(worker,()=>changes++,()=>details++,'https://example.test/');
  client.search('ward');client.search('dies');assert.equal(sent.length,1);
  const cardHits=search(index,'sol');assert.deepEqual(mergeResults('sol',cardHits,index),cardHits.map(cardId=>({kind:'card',cardId})));
  worker.onmessage({data:{type:'ready',release}});assert.equal(sent.at(-1).query,'dies');
  const previous=client.request;client.search('priority');
  worker.onmessage({data:{type:'results',request:previous,query:'dies',hits:rules('dies')}});assert.equal(client.hits,undefined);
  worker.onmessage({data:{type:'results',request:client.request,query:'priority',hits:rules('priority')}});assert.ok(client.hits);
  client.detail('cr:117');const detailReq=client.detailRequest;client.cancelDetail();
  worker.onmessage({data:{type:'detail',request:detailReq,detail:{}}});assert.equal(details,0);assert.ok(changes);
});

test('exact-card presentation softens prose matches without hiding exact references or changing routing',()=>{
  for(const q of ['blood moon','sol ring','The True Scriptures']){
    const cardHits=search(index,q),ruleHits=rules(q),before=mergeResults(q,cardHits,index,ruleHits);
    const secondary=secondaryRuleResults(q,cardHits,index,ruleHits);
    assert.ok(secondary.size>0,q);
    for(const h of [...ruleHits.direct,...ruleHits.exact])assert.ok(!secondary.has(h.id));
    assert.deepEqual(mergeResults(q,cardHits,index,ruleHits),before);
  }
  for(const q of ['sol','sheold','ward','deathtouch','702.19'])assert.equal(secondaryRuleResults(q,search(index,q),index,rules(q)).size,0,q);
  const flash=rules('flash'); // Exact card/glossary ambiguity must keep both prominent.
  assert.ok(flash.exact.some(h=>h.id==='glossary:flash'));
  assert.ok(!secondaryRuleResults('flash',search(index,'flash'),index,flash).has('glossary:flash'));
  assert.equal(secondaryRuleResults('blood moon',search(index,'blood moon'),index).size,0);
});
test('effective rendering removes preview labels/warning but retains source dates and identity',async()=>{
  const runtime=await hydrateRules(release,bytes('public/data/rules.json'),bytes('public/data/rules-index.json'));
  const preview={...release,mode:'preview' as const};
  const effective={...release,mode:'effective' as const,source:{...release.source,asOfDate:release.source.effectiveDate,effectiveStatus:'effective' as const}};
  for(const id of ['glossary:ward','cr:702.21a']){
    const detail=runtime.detail(id)!;
    const html=renderRule(detail,effective);
    assert.doesNotMatch(html,/preview|rules-notice/i);
    const disclosure=html.slice(html.indexOf('<details'));
    for(const value of [effective.source.effectiveDate,effective.source.retrievedAt,effective.source.url,effective.source.sha256])assert.ok(disclosure.includes(value));
    assert.doesNotMatch(ruleResultLabel(detail.document,effective),/preview/i);
    assert.match(ruleResultLabel(detail.document,preview),/PREVIEW/);
    assert.match(renderRule(detail,preview),/rules-notice/);
  }
  assert.equal(rulesStatusLabel(effective),`Rules · effective ${effective.source.effectiveDate}`);
  assert.match(rulesStatusLabel(preview),/Rules preview/);
});
