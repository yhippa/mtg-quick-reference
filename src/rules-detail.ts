import { escapeHtml as esc, renderSymbols } from './symbols.ts';
import { referenceUrl } from './omnisearch.ts';
import type { RuleDetail, RuleHit, RulesRelease, RuleDocument } from './rules-types.ts';
export function renderRule(detail:RuleDetail, release:RulesRelease) {
  const d=detail.family?.root??detail.document,s=release.source;
  const link=(h:RuleHit)=>`<a class="reference-link" href="${esc(referenceUrl(s.sha256,h.id))}">${esc(h.kind==='glossary'?h.title:h.title.startsWith(h.key)?h.title:`${h.key} — ${h.title}`)}</a>`;
  const text=(doc:RuleDocument)=>{
    // Each document uses only its own parser-validated references.
    const refs=new Set(doc.references);
    return doc.text.split(/((?<![\w.])[1-9]\d{2}(?:\.\d+)?[a-z]?(?!\w))/g).map((part,i)=>
      i%2&&refs.has(`cr:${part}`)?`<a href="${esc(referenceUrl(s.sha256,`cr:${part}`))}">${esc(part)}</a>`:renderSymbols(part)).join('').split('\n').map(p=>`<p>${p}</p>`).join('');
  };
  const family=detail.family;
  const body=family?`${d.text===d.title||d.title===`${d.key} — ${d.text}`?'':`<div class="family-intro">${text(d)}</div>`}${family.members.map(member=>{
    const doc=member.document,focused=doc.id===detail.document.id;
    return `<section class="family-member${focused?' focused-rule':''}" id="${esc(ruleAnchorId(doc.id))}" tabindex="-1" aria-labelledby="${esc(ruleAnchorId(doc.id))}-number"><h2 id="${esc(ruleAnchorId(doc.id))}-number"><a href="${esc(referenceUrl(s.sha256,doc.id))}"${focused?' aria-current="location"':''}>${esc(doc.key)}</a></h2>${text(doc)}${member.children.length?`<nav class="member-links" aria-label="Subrules of ${esc(doc.key)}"><a class="reference-link" href="${esc(referenceUrl(s.sha256,doc.id))}">Subrules of ${esc(doc.key)} →</a></nav>`:''}</section>`;
  }).join('')}`:text(d);
  const displayed=[d,...(family?.members.map(m=>m.document)??[])];
  const visibleIds=new Set(displayed.map(doc=>doc.id));
  const references=[...new Map([...detail.references,...(family?.members.flatMap(m=>m.references)??[])].filter(ref=>!visibleIds.has(ref.id)).map(ref=>[ref.id,ref])).values()];
  return `<p class="eyebrow">${d.kind==='glossary'?'GLOSSARY':'COMPREHENSIVE RULES'}${release.mode==='preview'?' · PREVIEW':''}</p>
<h1 tabindex="-1" id="rule-title">${esc(d.kind==='glossary'?d.title:d.title.startsWith(d.key)?d.title:`${d.key} — ${d.title}`)}</h1>
${release.mode==='preview'?`<p class="rules-notice">Preview snapshot · effective ${esc(s.effectiveDate)}. This release is not presented as the currently effective rules.</p>`:''}
<section class="face rule-body${family?' rule-family':''}">${body}</section>
${detail.parent?`<nav class="rule-links" aria-label="Parent rule"><h2>Parent</h2>${link(detail.parent)}</nav>`:''}
${detail.children.length?`<nav class="rule-links" aria-label="Subrules"><h2>${d.kind==='section'?'In this section':'Subrules'}</h2>${detail.children.map(link).join('')}</nav>`:''}
${references.length?`<nav class="rule-links" aria-label="Source references"><h2>Referenced in this text</h2>${references.map(link).join('')}</nav>`:''}
<details class="rule-source"><summary>Source · effective ${esc(s.effectiveDate)}</summary><p>Wizards of the Coast · <a href="${esc(s.url)}">Comprehensive Rules</a></p><p>Retrieved ${esc(s.retrievedAt)}<br>Build as of ${esc(s.asOfDate)} · ${esc(s.effectiveStatus)}<br>Parser ${esc(s.parserVersion)} · schema ${release.schemaVersion}<br>${displayed.map(doc=>`<span>${esc(doc.key)} · source lines ${doc.sourceLines.join('–')}</span>`).join('<br>')}</p><p class="snapshot-id">Snapshot ${esc(s.sha256)}<br>Requested document ${esc(detail.document.id)}${family?`<br>Reading family ${esc(d.id)}`:''}</p><p>Rule headings may include contextual titles; the body is source text.</p></details>`;
}

export function ruleResultLabel(hit:RuleHit, release?:RulesRelease):string {
  return `${hit.kind==='glossary'?'GLOSSARY':'RULE'}${release?.mode==='preview'?' · PREVIEW':''}`;
}
export function rulesStatusLabel(release:RulesRelease):string {
  return `Rules${release.mode==='preview'?' preview':''} · effective ${release.source.effectiveDate}`;
}

export function ruleAnchorId(id:string):string { return `rule-${id}`; }
