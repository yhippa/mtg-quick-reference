// Research-only retrieval engines. No production imports or runtime hooks.
import { normalize, makeIndex as makeCardIndex, search as cardSearch } from './data/card-search.mjs';
export { normalize };
import {tokens,buildBM25,queryBM25} from './data/rules-search.mjs';
export {tokens,buildBM25,queryBM25};
const unique = xs => [...new Set(xs)];
const top = (scores, limit=10) => [...scores].sort((a,b)=>b[1]-a[1] || a[0]-b[0]).slice(0,limit);
export function prepareRules(docs) {
  return docs.map(d=>({title:normalize(d.title),body:new Set(tokens(d.text??'')),titleTerms:new Set(tokens(d.title))}));
}
function linearRules(prepared, query) {
  const q=normalize(query), ts=unique(tokens(query)), hits=[];
  if(!ts.length) return [];
  prepared.forEach((d,i)=>{
    if(ts.every(t=>d.body.has(t)||d.titleTerms.has(t))) {
      const score=(d.title===q?100:0)+(d.title.startsWith(q)?20:0)+ts.reduce((s,t)=>s+(d.titleTerms.has(t)?5:1),0);
      hits.push([i,score]);
    }
  });
  return top(hits,20).map(([i,score])=>({i,score}));
}
export function createEngine(mode, rules, cards, stored) {
  const started=performance.now();
  const combined=[...cards,...rules];
  if(mode==='unified') {
    const idx=stored??buildBM25(combined);
    return {mode,initMs:performance.now()-started,index:idx,search:q=>queryBM25(idx,q).map(h=>({...combined[h.i],score:h.score}))};
  }
  const names=cards.map(c=>({name:c.title,rank:c.rank,faces:(c.aliases??[]).map(name=>({name}))}));
  const cardIndex=makeCardIndex(names);
  const direct=new Map(rules.map((d,i)=>[d.key.toLowerCase(),i]));
  const exactTitles=new Map();
  rules.forEach((d,i)=>{if(d.kind!=='rule') (exactTitles.get(normalize(d.title))??exactTitles.set(normalize(d.title),[]).get(normalize(d.title))).push(i);});
  const idx=mode==='linear'?prepareRules(rules):stored??buildBM25(mode==='unified-routed'?combined:rules);
  const search=q=>{
    const normalized=normalize(q);
    const number=q.trim().toLowerCase().replace(/^(?:cr|rules?)\s+/, '').replace(/\.$/,'');
    const explicit=/^(?:cr|rules?)\s+/i.test(q);
    const output=[];
    const add=d=>{if(d&&!output.some(x=>x.id===d.id))output.push(d);};
    if(/^\d{1,3}(?:\.\d+)?[a-z]?$/.test(number)&&direct.has(number))add(rules[direct.get(number)]);
    const cardHits=explicit?[]:cardSearch(cardIndex,q,10).map(i=>cards[i]);
    for(const c of cardHits) if(normalize(c.title)===normalized || c.aliases.some(a=>normalize(a)===normalized))add(c);
    for(const i of exactTitles.get(normalized)??[])add(rules[i]);
    if(!explicit&&normalized.split(' ').length<3) for(const c of cardHits.slice(0,4))add(c);
    const ruleHits=mode==='linear'?linearRules(idx,q):queryBM25(idx,explicit?q.replace(/^(?:cr|rules?)\s+/i,''):q,20,mode==='unified-routed'?cards.length:0).map(h=>({...h,i:h.i-(mode==='unified-routed'?cards.length:0)}));
    for(const h of ruleHits)add(rules[h.i]);
    for(const c of cardHits)add(c);
    return output.slice(0,10);
  };
  return {mode,initMs:performance.now()-started,index:mode==='linear'?null:idx,search};
}
