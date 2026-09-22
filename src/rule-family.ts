import type { RuleDocument, RuleDetail, RuleHit } from './rules-types.ts';
import { compactRule } from './rules-search.ts';
/** Conservative presentation boundary: complete prose children, not a catalog of labels.
 * No rule-number depth or mechanic-specific IDs participate in this decision.
 * Mixed groups/colon-led lists stay navigational rather than guessing their structure.
 */
export function isReadingFamily(children:RuleDocument[]):boolean {
  return children.length>0 && children.every(d=>d.kind==='rule' && /[.!?](?:[”"’)\]]|\s|$)/.test(d.text));
}
export function createRuleDetails(documents:RuleDocument[]) {
  const byId=new Map(documents.map(d=>[d.id,d]));
  const children=new Map<string,RuleDocument[]>();
  for(const d of documents)if(d.parentId){const list=children.get(d.parentId)??[];list.push(d);children.set(d.parentId,list);}
  for(const list of children.values())list.sort((a,b)=>a.order-b.order);
  const links=(ids:string[]):RuleHit[]=>ids.flatMap(id=>byId.has(id)?[compactRule(byId.get(id)!)]:[]);
  return (id:string):RuleDetail|null=>{
    const document=byId.get(id);if(!document)return null;
    const own=children.get(id)??[],parent=document.parentId?byId.get(document.parentId):undefined;
    // A nested container opens its own direct children. A leaf joins its nearest family.
    const root=isReadingFamily(own)?document:!own.length&&parent&&isReadingFamily(children.get(parent.id)??[])?parent:undefined;
    const readingRoot=root??document;
    const members=root?children.get(root.id)!:[];
    return {document,parent:readingRoot.parentId?compactRule(byId.get(readingRoot.parentId)!):null,
      children:root?[]:own.map(compactRule),references:links(readingRoot.references),
      ...(root?{family:{root,members:members.map(d=>({document:d,children:(children.get(d.id)??[]).map(compactRule),references:links(d.references)}))}}:{})};
  };
}
