/** Escape source text before adding our own trusted symbol markup. */
export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]!));

const labels: Record<string, string> = {
  W: 'white mana', U: 'blue mana', B: 'black mana', R: 'red mana', G: 'green mana',
  C: 'colorless mana', T: 'Tap', Q: 'Untap', S: 'snow mana', E: 'Energy',
  TK: 'Ticket', P: 'Phyrexian mana', X: 'X mana', Y: 'Y mana', Z: 'Z mana',
};
const glyphs: Record<string, string> = { T: '↷', Q: '↶', C: '◇', S: '❄', E: 'ϟ', TK: 'Tk', P: 'Φ' };
const colors: Record<string, string> = { W: '#f2ead0', U: '#b9d8e9', B: '#c4bdca', R: '#eab7a4', G: '#b9d0b0' };

/** Shared by mana costs, Oracle text and rulings. Unknown notation stays readable. */
export function renderSymbols(text = ''): string {
  return escapeHtml(text).replace(/\{([^{}]+)\}/g, (original, token: string) => {
    const parts = token.split('/');
    const numeric = (part: string) => /^\d+$/.test(part);
    const hybrid = /^[2CWUBRG]\/[WUBRGP](?:\/P)?$/.test(token);
    if (!Object.hasOwn(labels, token) && !numeric(token) && !hybrid) return original;
    const label = hybrid ? `${parts.map(p => p === 'P' ? '2 life' : labels[p] ?? `${p} generic mana`).join(' or ')}`
      : labels[token] ?? `${token} generic mana`;
    const color = colors[parts[0]] ?? '#deddd7';
    const second = colors[parts[1]] ?? color;
    // Style values come exclusively from the fixed palette, never source text.
    const style = hybrid ? ` style="background:linear-gradient(135deg,${color} 50%,${second} 50%)"` : '';
    const css = token === 'T' || token === 'Q' ? ' mana-action' : hybrid ? ' mana-hybrid' : '';
    const glyph = parts.map(p => glyphs[p] ?? p).join('/');
    return `<span class="mana m-${colors[token] ? token : 'generic'}${css}" role="img" aria-label="${label}" title="${label}"${style}>${glyph}</span>`;
  });
}
