import { normalize, type makeIndex } from './search.ts';
import type { RuleHit, RulesHits } from './rules-types.ts';
export type SearchResult = {kind:'card';cardId:number} | RuleHit;
/** Merge already-computed card hits. Never build another card index. */
export function mergeResults(query: string, cardIds: number[], index: ReturnType<typeof makeIndex>, rules?: RulesHits, limit=20): SearchResult[] {
  if (!rules) return cardIds.map(cardId=>({kind:'card',cardId}));
  const output: SearchResult[]=[]; const seen=new Set<string>();
  const add=(h:SearchResult)=>{const id=h.kind==='card'?`card:${h.cardId}`:h.id;if(!seen.has(id)){seen.add(id);output.push(h);}};
  const card=(id:number)=>add({kind:'card',cardId:id});
  const q=normalize(query),explicit=/^(?:cr|rules?)\s+/i.test(query);
  const hits=explicit?[]:cardIds;
  rules.direct.forEach(add);
  hits.filter(id=>index[id].names.some(n=>n.name===q)).forEach(card);
  rules.exact.forEach(add);
  if(q.split(' ').length<3)hits.slice(0,4).forEach(card);
  rules.ranked.forEach(add);hits.forEach(card);
  return output.slice(0,limit);
}
export function referenceUrl(snapshot:string,id:string) { return `#${new URLSearchParams({rules:snapshot,ref:id})}`; }
export function readRoute(hash:string): {kind:'card';name:string}|{kind:'rule';snapshot:string;id:string}|{kind:'search'} {
  const p=new URLSearchParams(hash.replace(/^#/,''));
  if(p.has('ref'))return {kind:'rule',snapshot:p.get('rules')??'',id:p.get('ref')!};
  if(p.has('card'))return {kind:'card',name:p.get('card')!};
  return {kind:'search'};
}

/** Presentation only: routed exact references remain prominent alongside exact cards. */
export function secondaryRuleResults(query:string, cardIds:number[], index:ReturnType<typeof makeIndex>, rules?:RulesHits):Set<string> {
  const q=normalize(query);
  if(!rules || !q || !cardIds.some(id=>index[id].names.some(n=>n.name===q)))return new Set();
  const direct=new Set([...rules.direct,...rules.exact].map(h=>h.id));
  return new Set(rules.ranked.filter(h=>!direct.has(h.id)).map(h=>h.id));
}
