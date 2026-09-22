// Research-only conservative experiment. Does not alter production search.
import {readFileSync,writeFileSync} from 'node:fs';
import {makeIndex,search,normalize} from '../../src/search.ts';
import {createRulesSearch} from '../../src/rules-search.ts';
import {mergeResults} from '../../src/omnisearch.ts';
import {createRuleDetails} from '../../src/rule-family.ts';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const corpus=read('public/data/rules.json'),cards=read('public/data/cards.json').cards,names=makeIndex(cards);
const rules=createRulesSearch(corpus.documents,read('public/data/rules-index.json').index),detail=createRuleDetails(corpus.documents);
const byId=new Map(corpus.documents.map((d:any)=>[d.id,d]));
const run=(q:string)=>{
 const hits=mergeResults(q,search(names,q),names,rules(q));
 const roots=new Set(hits.flatMap(h=>{
  if(h.kind==='card')return [];
  const d=detail(h.id);
  return d?.family?.root.id===h.id&&normalize(d.family.root.text)===normalize(q)?[h.id]:[];
 }));
 const collapsed=hits.filter(h=>h.kind==='card'||!roots.has((byId.get(h.id) as any)?.parentId));
 const ids=(xs:typeof hits)=>xs.slice(0,10).map(h=>h.kind==='card'?'card:'+encodeURIComponent(cards[h.cardId].name):h.id);
 return {query:q,before:ids(hits),after:ids(collapsed)};
};
const cases=read('research/omnisearch/evaluation.json').cases;
const dcg=(ids:string[],relevance:any)=>ids.slice(0,5).reduce((s,id,i)=>s+(2**(relevance[id]??0)-1)/Math.log2(i+2),0);
const changes=cases.map((c:any)=>{const r=run(c.query);return {...r,dcg5Before:dcg(r.before,c.relevance),dcg5After:dcg(r.after,c.relevance)};}).filter((r:any)=>JSON.stringify(r.before)!==JSON.stringify(r.after));
const report={policy:'For exact family-heading concept queries only, remove direct children when their parent is already present in the 20 results. Never collapse a numbered or phrase query.',changes,examples:['banding','702.22a','attacking creatures to share abilities','flash','ward','trample'].map(run),decision:'Not shipped. The 66-query frozen set shows no DCG@5 regression, but freed positions expose broader distinct matches (for example 802.3b and 508.1e for banding). These are source-related; the granular judgments do not establish whether they are better destinations than child-focused family views. Heading equality alone cannot resolve that ambiguity. Keep validated retrieval unchanged for this reading-focused release.'};
writeFileSync('research/v121/collapse-evaluation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({changedQueries:changes.length,regressions:changes.filter((r:any)=>r.dcg5After<r.dcg5Before).map((r:any)=>r.query),examples:report.examples.slice(0,3)},null,2));
