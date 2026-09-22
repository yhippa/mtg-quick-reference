import './style.css';
import { RulesClient } from './rules-client.ts';
import { mergeResults, readRoute, referenceUrl, secondaryRuleResults } from './omnisearch.ts';
import { renderRule, ruleResultLabel, rulesStatusLabel } from './rules-detail.ts';
import { renderCard } from './detail.ts';
import { readRecent, remember, saveRecent } from './recent.ts';
import { escapeHtml as esc, renderSymbols as mana } from './symbols.ts';
import { makeIndex, search, suggest, type Card, type Dataset } from './search.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
<header><div class="brand"><span class="brand-mark" aria-hidden="true">ϟ</span><div>MTG <span>QUICK REFERENCE</span></div></div><button id="theme" class="icon-button" aria-label="Change color theme" title="Change color theme">◐</button></header>
<main><section id="search-view"><h1 class="search-title">Find a reference.</h1>
<form id="search-form" role="search"><label class="sr-only" for="query">Search cards, rules, mechanics</label><div class="search-box"><span aria-hidden="true">⌕</span><input id="query" type="search" placeholder="Search cards, rules, mechanics…" autocomplete="off" autocapitalize="off" spellcheck="false" autofocus enterkeyhint="search"><button id="clear" type="button" aria-label="Clear search" hidden>×</button></div></form>
<div class="results-heading"><span id="result-status" role="status">Loading card reference…</span><button id="clear-recent" hidden>Clear recent</button><span class="key-hint">/ TO SEARCH</span></div><div id="results"></div>
<p id="rules-status" class="rules-status" role="status">Rules loading…</p><div id="empty"><p>Find card text, rulings, rules, and glossary terms.</p><div class="suggestions"><button data-query="bolt">bolt <span>↗</span></button><button data-query="sheold">sheold <span>↗</span></button><button data-query="Sol Ring">Sol Ring <span>↗</span></button></div></div></section>
<section id="detail-view" hidden><nav class="detail-nav" aria-label="Reference navigation"><button id="back" class="back">← Back</button><button id="new-search" class="new-search">New search</button></nav><article id="detail"></article></section></main>
<footer><div><span id="offline" role="status">Preparing reference</span><button id="update" hidden>Update ready · Reload</button></div><div id="data-date">Card data loading</div><p>Card data by <a href="https://mtgjson.com/">MTGJSON</a> · Magic: The Gathering © Wizards of the Coast</p></footer>`;
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const input = el<HTMLInputElement>('query');
let dataset: Dataset;
let index: ReturnType<typeof makeIndex> = [];
let ready = false;
let failed = false;
let rules: RulesClient | undefined;
let routeToken = '';
function rulesChanged() {
  const release=rules?.release;
  el('rules-status').textContent=rules?.state==='error'?'Rules unavailable · Card search still works. Reload to retry.':!release?'Rules loading…':rulesStatusLabel(release);
  if(readRoute(location.hash).kind==='rule') route();
  else if(el('detail-view').hidden) renderSearch();
}


let recent: string[] = [];
try { recent = readRecent(localStorage); } catch {}
function persistRecent() { try { saveRecent(localStorage, recent); } catch {} }
function renderSearch() {
  el('clear').hidden = !input.value;
  if (!ready) return;
  const hasQuery = !!input.value.trim();
  let ids = hasQuery ? search(index, input.value) : recent.map(name => dataset.cards.findIndex(c => c.name === name)).filter(id => id >= 0);
  let suggestions = false;
  if (hasQuery && !ids.length) { ids = suggest(index, input.value); suggestions = ids.length > 0; }
  el('results').classList.toggle('recent-results', !hasQuery && ids.length > 0);
  el('empty').hidden = hasQuery || ids.length > 0;
  el('clear-recent').hidden = hasQuery || ids.length === 0;
  el('result-status').textContent = input.value.trim() ? `${ids.length === 20 ? 'Top 20' : ids.length} matching card${ids.length === 1 ? '' : 's'}` : `${dataset.cards.length.toLocaleString()} cards at your fingertips`;
  if (!hasQuery && ids.length) el('result-status').textContent = 'Recently viewed';
  if (suggestions) el('result-status').textContent = 'No exact results · Did you mean?';
  if (rules && rules.query !== input.value) rules.search(input.value);
  const hits=hasQuery&&!suggestions?mergeResults(input.value,ids,index,rules?.hits):ids.map(cardId=>({kind:'card' as const,cardId}));
  // Typo suggestions are only a fallback when neither source has actual matches.
  const results=suggestions&&rules?.hits&&(rules.hits.direct.length||rules.hits.exact.length||rules.hits.ranked.length)?mergeResults(input.value,[],index,rules.hits):hits;
  const secondary=hasQuery?secondaryRuleResults(input.value,ids,index,rules?.hits):new Set<string>();
  const active=(document.activeElement as HTMLElement)?.closest<HTMLElement>('[data-card],[data-rule]');
  const focusCard=active?.dataset.card,focusRule=active?.dataset.rule;
  if(hasQuery&&!suggestions)el('result-status').textContent=`${results.length===20?'Top 20':results.length} matching reference${results.length===1?'':'s'}`;
  if(suggestions&&results.some(r=>r.kind!=='card'))el('result-status').textContent=`${results.length} matching references`;
  el('results').innerHTML=results.map(hit=>{
    if(hit.kind!=='card')return `<button class="result rule-result${secondary.has(hit.id)?' secondary-result':''}" data-rule="${esc(hit.id)}"><span class="result-copy"><span class="result-kind">${ruleResultLabel(hit,rules?.release)}</span><strong>${esc(hit.kind==='section'?`${hit.key} — ${hit.title}`:hit.title)}</strong></span><span class="chevron">›</span></button>`;
    const id=hit.cardId,card=dataset.cards[id];
    return `<button class="result" data-card="${id}"><span class="result-copy"><strong>${esc(card.name)}</strong><small>${esc(card.faces.map(f=>f.type).join(' // '))}</small></span><span class="result-end"><span class="cost">${mana(card.faces[0].mana)}</span><span class="chevron">›</span></span></button>`;
  }).join('')||(hasQuery?'<div class="no-results"><h2>No references found</h2><p>Try a card name, a glossary term such as ward, or a rule number such as 702.19.</p></div>':'');
  if(focusCard!==undefined)el('results').querySelector<HTMLButtonElement>(`[data-card="${focusCard}"]`)?.focus({preventScroll:true});
  if(focusRule) Array.from(el('results').querySelectorAll<HTMLButtonElement>('[data-rule]')).find(b=>b.dataset.rule===focusRule)?.focus({preventScroll:true});
}

function showCard(card: Card) {
  recent = remember(recent, card.name);
  persistRecent();
  el('search-view').hidden = true;
  el('detail-view').hidden = false;
  el('detail').innerHTML = renderCard(card);
  input.blur();
  el('card-title').focus();
  window.scrollTo(0, 0);
}
function route() {
  if (!ready) return;
  const target=readRoute(location.hash);
  if(target.kind==='rule') {
    el('search-view').hidden=true;el('detail-view').hidden=false;
    input.blur();
    if(rules?.state==='error') {el('detail').innerHTML='<h1>Rules unavailable</h1><p>Reload to retry. Card search is still available.</p>';return;}
    if(!rules?.release) {el('detail').innerHTML='<p class="muted">Loading rules reference…</p>';return;}
    if(target.snapshot!==rules.release.source.sha256) {el('detail').innerHTML='<h1>Different rules snapshot</h1><p>This link refers to another rules edition. Start a new search to find a reference in the installed snapshot.</p>';return;}
    if(routeToken!==location.hash){routeToken=location.hash;el('detail').innerHTML='<p class="muted">Loading reference…</p>';rules.detail(target.id);}
    return;
  }
  routeToken='';rules?.cancelDetail();
  const card = target.kind==='card'?dataset.cards.find(c=>c.name===target.name):undefined;
  if (card) showCard(card);
  else {
    el('search-view').hidden = false; el('detail-view').hidden = true;
    if (typeof history.state?.query === 'string') input.value = history.state.query;
    renderSearch();
    const selected = typeof history.state?.selected === 'number' ? el('results').querySelector<HTMLButtonElement>(`[data-card="${history.state.selected}"]`) : Array.from(el('results').querySelectorAll<HTMLButtonElement>('[data-rule]')).find(b=>b.dataset.rule===history.state?.selected);
    (selected ?? input).focus({ preventScroll: true });
    window.scrollTo(0, history.state?.scroll ?? 0);
  }
}
const searchUrl = () => location.pathname + location.search;
function saveSearch(selected?: number | string) {
  history.replaceState({ query: input.value, scroll: window.scrollY, selected }, '', searchUrl());
}
function newSearch() {
  history.pushState({ query: '', scroll: 0 }, '', searchUrl());
  route();
  input.focus(); // Synchronous with the tap so mobile browsers can open the keyboard.
}
el('new-search').onclick = newSearch;
input.addEventListener('input', () => {saveSearch(); renderSearch();});
el('clear-recent').onclick = () => { recent = []; persistRecent(); saveSearch(); renderSearch(); input.focus(); };
el('clear').onclick = () => { input.value = ''; saveSearch(); renderSearch(); input.focus(); };
el('search-form').onsubmit = event => { event.preventDefault(); el('results').querySelector<HTMLButtonElement>('button')?.click(); };
el('results').onclick = event => {
  const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-card],[data-rule]');
  if(!button)return;
  if(button.dataset.rule&&rules?.release){saveSearch(button.dataset.rule);history.pushState({detail:true},'',referenceUrl(rules.release.source.sha256,button.dataset.rule));}
  else if(button.dataset.card!==undefined){const id=Number(button.dataset.card);saveSearch(id);history.pushState({detail:true},'',`#${new URLSearchParams({card:dataset.cards[id].name})}`);}
  route();
};
el('detail').onclick=event=>{
  const link=(event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
  if(!link || (event as MouseEvent).metaKey || (event as MouseEvent).ctrlKey)return;
  event.preventDefault();history.pushState({detail:true},'',link.getAttribute('href')!);route();
};
el('empty').onclick = event => {
  const button = (event.target as HTMLElement).closest<HTMLElement>('[data-query]');
  if (button) { input.value = button.dataset.query!; saveSearch(); renderSearch(); input.focus(); }
};
el('back').onclick = () => { if (history.state?.detail) history.back(); else { history.replaceState({ query: input.value, scroll: 0 }, '', searchUrl()); route(); } };
window.addEventListener('popstate', route);
window.addEventListener('hashchange', route);
window.addEventListener('keydown', event => {
  if (event.key === '/' && document.activeElement !== input) { event.preventDefault(); if (!el('detail-view').hidden) newSearch(); else input.focus(); }
  if (event.key === 'Escape' && !el('detail-view').hidden) el('back').click();
});
let theme = 'system';
try { theme = localStorage.getItem('theme') || 'system'; } catch { /* Storage may be unavailable. */ }
function applyTheme() { document.documentElement.dataset.theme = theme; el('theme').setAttribute('aria-label', `Theme: ${theme}. Change theme`); }
applyTheme();
el('theme').onclick = () => { theme = theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system'; applyTheme(); try { localStorage.setItem('theme', theme); } catch {} };
async function load() {
  try {
    const response = await fetch('./data/cards.json');
    if (!response.ok) throw new Error('Dataset unavailable');
    dataset = await response.json();
    if (dataset.schema !== 1 || !dataset.cards?.length) throw new Error('Invalid dataset');
    index = makeIndex(dataset.cards);
    const names = new Set(dataset.cards.map(c => c.name));
    recent = recent.filter(name => names.has(name));
    persistRecent();
    ready = true; failed = false;
    el('data-date').textContent = `Card data · ${dataset.updated}`;
    route();
    // Card search is usable before any rules work starts. All corpus parsing stays in the worker.
    setTimeout(()=>{
      try {
        rules=new RulesClient(new Worker(new URL('./rules.worker.ts',import.meta.url),{type:'module'}),rulesChanged,detail=>{
          const current=readRoute(location.hash);
          if(current.kind!=='rule'||!rules?.release)return;
          if(detail&&current.id===detail.document.id){el('detail').innerHTML=renderRule(detail,rules.release);el('rule-title').focus();window.scrollTo(0,0);}
          else if(!detail)el('detail').innerHTML='<h1>Reference not found</h1><p>Start a new search in this snapshot.</p>';
        },new URL('./',location.href).href);
        rules.search(input.value);
      }catch{el('rules-status').textContent='Rules unavailable · Card search still works.';}
    },0);
    await setupOffline();
  } catch {
    failed = true;
    el('result-status').textContent = 'Could not load the card reference.';
    el('results').innerHTML = '<p>Connect to the internet for the first download.</p><button id="retry" class="back">Try again</button>';
    el('retry').onclick = () => { el('result-status').textContent = 'Loading card reference…'; load(); };
    el('offline').textContent = 'Reference unavailable';
  }
}
let cached = false;
function connectionStatus() {
  if (failed) return;
  el('offline').textContent = cached ? (navigator.onLine ? '● Available offline' : '● Offline · Ready to search') : (navigator.onLine ? 'Saving for offline use…' : 'Offline · Not saved yet');
}
async function setupOffline() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) { el('offline').textContent = 'Offline caching requires a production build'; return; }
  try {
    connectionStatus();
    const registration = await navigator.serviceWorker.register('./sw.js');
    const check = () => { el('update').hidden = !(registration.waiting && navigator.serviceWorker.controller); };
    const watchInstall = () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        check();
        if (worker.state === 'redundant' && !registration.active) el('offline').textContent = 'Offline save failed · Reload to retry';
      });
    };
    watchInstall();
    check();
    registration.addEventListener('updatefound', watchInstall);
    el('update').onclick = () => registration.waiting?.postMessage('ACTIVATE');
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
    await navigator.serviceWorker.ready;
    cached = true; connectionStatus();
  } catch { el('offline').textContent = 'Offline save failed · Reload to retry'; }
}
window.addEventListener('online', connectionStatus);
window.addEventListener('offline', connectionStatus);
load();
