import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSymbols } from '../src/symbols.ts';

test('Sol Ring renders tap and two colorless symbols within readable text', () => {
  const html = renderSymbols('{T}: Add {C}{C}.');
  assert.match(html, /aria-label="Tap"/);
  assert.equal((html.match(/aria-label="colorless mana"/g) ?? []).length, 2);
  assert.match(html, /ms-tap/);
  assert.match(html, /ms-c[" ]/);
  assert.match(html, /<\/span>: Add /);
  assert.ok(!html.includes('{C}'));
});
test('costs, hybrid, Phyrexian and other common symbols have accessible labels', () => {
  for (const [symbol, label] of [['2','2 generic mana'],['W','white mana'],['X','X mana'],['Q','Untap'],['S','snow mana'],['E','Energy'],['TK','Ticket'],['W/U','white mana or blue mana'],['B/P','black mana or 2 life'],['G/W/P','green mana or white mana or 2 life']]) {
    assert.ok(renderSymbols(`{${symbol}}`).includes(`aria-label="${label}"`), symbol);
  }
});
test('source HTML is escaped and unknown notation is preserved', () => {
  assert.equal(renderSymbols('<img src=x onerror="bad()"> {UNKNOWN}'), '&lt;img src=x onerror=&quot;bad()&quot;&gt; {UNKNOWN}');
  assert.equal(renderSymbols('{<script>}'), '{&lt;script&gt;}');
  assert.equal(renderSymbols('First line\nSecond line'), 'First line\nSecond line');
});
test('all rendered glyph classes exist in the bundled offline stylesheet', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../public/fonts/mana/mana.css', import.meta.url), 'utf8');
  const font = readFileSync(new URL('../public/fonts/mana/mana.woff2', import.meta.url));
  assert.equal(font.subarray(0, 4).toString(), 'wOF2');
  for (const token of ['T','Q','C','W','U','B','R','G','S','E','TK','P','0','20','W/U','B/P','G/W/P','½','∞']) {
    const html = renderSymbols(`{${token}}`);
    const cls = html.match(/ms-cost (ms-[\w-]+)/)?.[1];
    assert.ok(cls && css.includes(`.${cls}::before`), token);
  }
  assert.equal(renderSymbols('{21} {UNKNOWN}'), '{21} {UNKNOWN}');
});
