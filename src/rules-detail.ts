import { escapeHtml as esc, renderSymbols } from './symbols.ts';
import { referenceUrl } from './omnisearch.ts';
import type { RuleDetail, RuleHit, RulesRelease } from './rules-types.ts';
export function renderRule(detail:RuleDetail, release:RulesRelease) {
  const d=detail.document,s=release.source;
  const link=(h:RuleHit)=>`<a class="reference-link" href="${esc(referenceUrl(s.sha256,h.id))}">${esc(h.kind==='glossary'?h.title:h.title.startsWith(h.key)?h.title:`${h.key} — ${h.title}`)}</a>`;
  // Link only explicit tokens that the parser validated. Everything else stays literal source text.
  const refs=new Set(d.references);
  const text=d.text.split(/((?<![\w.])[1-9]\d{2}(?:\.\d+)?[a-z]?(?!\w))/g).map((part,i)=>
    i%2&&refs.has(`cr:${part}`)?`<a href="${esc(referenceUrl(s.sha256,`cr:${part}`))}">${esc(part)}</a>`:renderSymbols(part)).join('');
  return `<p class="eyebrow">${d.kind==='glossary'?'GLOSSARY':'COMPREHENSIVE RULES'}${release.mode==='preview'?' · PREVIEW':''}</p>
<h1 tabindex="-1" id="rule-title">${esc(d.kind==='glossary'?d.title:d.title.startsWith(d.key)?d.title:`${d.key} — ${d.title}`)}</h1>
${release.mode==='preview'?`<p class="rules-notice">Preview snapshot · effective ${esc(s.effectiveDate)}. This release is not presented as the currently effective rules.</p>`:''}
<section class="face rule-body">${text.split('\n').map(p=>`<p>${p}</p>`).join('')}</section>
${detail.parent?`<nav class="rule-links" aria-label="Parent rule"><h2>Parent</h2>${link(detail.parent)}</nav>`:''}
${detail.children.length?`<nav class="rule-links" aria-label="Subrules"><h2>${d.kind==='section'?'In this section':'Subrules'}</h2>${detail.children.map(link).join('')}</nav>`:''}
${detail.references.length?`<nav class="rule-links" aria-label="Source references"><h2>Referenced in this text</h2>${detail.references.map(link).join('')}</nav>`:''}
<details class="rule-source"><summary>Source · effective ${esc(s.effectiveDate)}</summary><p>Wizards of the Coast · <a href="${esc(s.url)}">Comprehensive Rules</a></p><p>Retrieved ${esc(s.retrievedAt)}<br>Build as of ${esc(s.asOfDate)} · ${esc(s.effectiveStatus)}<br>Parser ${esc(s.parserVersion)} · schema ${release.schemaVersion}<br>Source lines ${d.sourceLines.join('–')}</p><p class="snapshot-id">Snapshot ${esc(s.sha256)}<br>Document ${esc(d.id)}</p><p>Rule headings may include contextual titles; the body is source text.</p></details>`;
}

export function ruleResultLabel(hit:RuleHit, release?:RulesRelease):string {
  return `${hit.kind==='glossary'?'GLOSSARY':'RULE'}${release?.mode==='preview'?' · PREVIEW':''}`;
}
export function rulesStatusLabel(release:RulesRelease):string {
  return `Rules${release.mode==='preview'?' preview':''} · effective ${release.source.effectiveDate}`;
}
