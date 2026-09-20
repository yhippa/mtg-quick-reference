import './style.css';
import { escapeHtml as esc, renderSymbols as mana } from './symbols.ts';
import { makeIndex, search, type Card, type Dataset } from './search.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
<header><div class="brand"><span class="brand-mark" aria-hidden="true">ϟ</span><div>MTG <span>QUICK REFERENCE</span></div></div><button id="theme" class="icon-button" aria-label="Change color theme" title="Change color theme">◐</button></header>
<main><section id="search-view"><h1 class="search-title">Find a card.</h1>
<form id="search-form" role="search"><label class="sr-only" for="query">Search card names</label><div class="search-box"><span aria-hidden="true">⌕</span><input id="query" type="search" placeholder="Search any card name…" autocomplete="off" autocapitalize="off" spellcheck="false" autofocus enterkeyhint="search"><button id="clear" type="button" aria-label="Clear search" hidden>×</button></div></form>
<div class="results-heading"><span id="result-status" role="status">Loading card reference…</span><span class="key-hint">/ TO SEARCH</span></div><div id="results"></div>
<div id="empty"><p>Search a name for Oracle text and rulings.</p><div class="suggestions"><button data-query="bolt">bolt <span>↗</span></button><button data-query="sheold">sheold <span>↗</span></button><button data-query="Sol Ring">Sol Ring <span>↗</span></button></div></div></section>
<section id="detail-view" hidden><button id="back" class="back">← Back to search</button><article id="detail"></article></section></main>
<footer><div><span id="offline" role="status">Preparing reference</span><button id="update" hidden>Update ready · Reload</button></div><div id="data-date">Card data loading</div><p>Card data by <a href="https://mtgjson.com/">MTGJSON</a> · Magic: The Gathering © Wizards of the Coast</p></footer>`;
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const input = el<HTMLInputElement>('query');
let dataset: Dataset;
let index: ReturnType<typeof makeIndex> = [];
let ready = false;
let failed = false;
let lastFocus: HTMLElement | null = null;
function renderSearch() {
  el('clear').hidden = !input.value;
  if (!ready) return;
  const ids = search(index, input.value);
  el('empty').hidden = !!input.value.trim();
  el('result-status').textContent = input.value.trim() ? `${ids.length === 20 ? 'Top 20' : ids.length} matching card${ids.length === 1 ? '' : 's'}` : `${dataset.cards.length.toLocaleString()} cards at your fingertips`;
  el('results').innerHTML = ids.map(id => {
    const card = dataset.cards[id];
    return `<button class="result" data-card="${id}"><span class="result-copy"><strong>${esc(card.name)}</strong><small>${esc(card.faces.map(f => f.type).join(' // '))}</small></span><span class="result-end"><span class="cost">${mana(card.faces[0].mana)}</span><span class="chevron">›</span></span></button>`;
  }).join('') || (input.value.trim() ? '<div class="no-results"><h2>No cards found</h2><p>Try a shorter name or a different word in the name.</p></div>' : '');
}
function showCard(card: Card) {
  el('search-view').hidden = true;
  el('detail-view').hidden = false;
  el('detail').innerHTML = `<div class="eyebrow">CARD REFERENCE</div><h1 tabindex="-1" id="card-title">${esc(card.name)}</h1>${card.faces.map((f, i) => `<section class="face">${card.faces.length > 1 ? `<div class="face-label">FACE ${i + 1}</div><h2>${esc(f.name)}</h2>` : ''}<div class="face-meta"><span>${esc(f.type)}</span><span class="cost">${mana(f.mana)}</span></div><div class="oracle">${(f.text || 'No Oracle text.').split('\n').map(p => `<p>${mana(p)}</p>`).join('')}</div><div class="stats">${f.power !== undefined ? `<span>${esc(f.power)} / ${esc(f.toughness ?? '')}</span>` : ''}${f.loyalty !== undefined ? `<span>Loyalty ${esc(f.loyalty)}</span>` : ''}${f.defense !== undefined ? `<span>Defense ${esc(f.defense)}</span>` : ''}</div></section>`).join('')}<section class="rulings"><div class="rulings-title"><h2>Official rulings</h2><span>${card.rulings.length}</span></div>${card.rulings.length ? card.rulings.map(([date,text]) => `<div class="ruling"><time datetime="${esc(date)}">${esc(date || 'Undated')}</time><p>${mana(text)}</p></div>`).join('') : '<p class="muted">No card-specific rulings in this dataset.</p>'}</section>`;
  input.blur();
  el('card-title').focus();
  window.scrollTo(0, 0);
}
function route() {
  if (!ready) return;
  const name = new URLSearchParams(location.hash.slice(1)).get('card');
  const card = name ? dataset.cards.find(c => c.name === name) : undefined;
  if (card) showCard(card);
  else {
    el('search-view').hidden = false; el('detail-view').hidden = true;
    renderSearch();
    (lastFocus?.isConnected ? lastFocus : input).focus({ preventScroll: true });
  }
}
input.addEventListener('input', renderSearch);
el('clear').onclick = () => { input.value = ''; renderSearch(); input.focus(); };
el('search-form').onsubmit = event => { event.preventDefault(); el('results').querySelector<HTMLButtonElement>('button')?.click(); };
el('results').onclick = event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-card]');
  if (!button) return;
  lastFocus = button;
  history.pushState({ detail: true }, '', `#${new URLSearchParams({card: dataset.cards[Number(button.dataset.card)].name})}`); route();
};
el('empty').onclick = event => {
  const button = (event.target as HTMLElement).closest<HTMLElement>('[data-query]');
  if (button) { input.value = button.dataset.query!; renderSearch(); input.focus(); }
};
el('back').onclick = () => { if (history.state?.detail) history.back(); else { history.replaceState(null, '', location.pathname + location.search); route(); } };
window.addEventListener('popstate', route);
window.addEventListener('hashchange', route);
window.addEventListener('keydown', event => {
  if (event.key === '/' && document.activeElement !== input) { event.preventDefault(); history.replaceState(null, '', location.pathname + location.search); route(); input.focus(); }
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
    index = makeIndex(dataset.cards); ready = true; failed = false;
    el('data-date').textContent = `Card data · ${dataset.updated}`;
    route();
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
