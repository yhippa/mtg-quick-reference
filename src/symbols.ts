/** Escape source text before adding our own trusted symbol markup. */
export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]!));

const labels: Record<string, string> = {
  W: 'white mana', U: 'blue mana', B: 'black mana', R: 'red mana', G: 'green mana',
  C: 'colorless mana', T: 'Tap', Q: 'Untap', S: 'snow mana', E: 'Energy',
  TK: 'Ticket', P: 'Phyrexian mana', X: 'X mana', Y: 'Y mana', Z: 'Z mana',
};
const symbols: Record<string, string> = {
  T: 'tap', Q: 'untap', '½': '1-2', '∞': 'infinity', CHAOS: 'chaos',
};
const hybridSymbols = new Set('WU WB UB UR BR BG RW RG GW GU 2W 2U 2B 2R 2G CW CU CB CR CG WP UP BP RP GP WUP WBP UBP URP BRP BGP RWP RGP GWP GUP'.split(' '));

/** Shared by mana costs, Oracle text and rulings. Unknown notation stays readable. */
export function renderSymbols(text = ''): string {
  return escapeHtml(text).replace(/\{([^{}]+)\}/g, (original, token: string) => {
    const parts = token.split('/');
    const numeric = /^(?:[0-9]|1[0-9]|20|100|1000000)$/.test(token);
    const hybridKey = parts.join('');
    const hybrid = parts.length > 1 && hybridSymbols.has(hybridKey);
    if (!Object.hasOwn(labels, token) && !Object.hasOwn(symbols, token) && !numeric && !hybrid) return original;
    const label = hybrid ? parts.map(p => p === 'P' ? '2 life' : labels[p] ?? `${p} generic mana`).join(' or ')
      : labels[token] ?? ({'½': 'half a generic mana', '∞': 'infinite generic mana', CHAOS: 'Chaos'}[token] ?? `${token} generic mana`);
    const symbol = symbols[token] ?? hybridKey.toLowerCase();
    return `<span class="card-symbol ms ms-cost ms-${symbol}" role="img" aria-label="${label}" title="${label}"></span>`;
  });
}
