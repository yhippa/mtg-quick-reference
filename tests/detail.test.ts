import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { renderCard } from '../src/detail.ts';
import { renderSymbols, escapeHtml } from '../src/symbols.ts';
import type { Card } from '../src/search.ts';

// Exercise the actual Python transformer and actual renderer with a fixed MTGJSON excerpt.
const data = JSON.parse(execFileSync('python3', ['-c',
  'import json; from scripts.build_data import transform; print(json.dumps(transform(json.load(open("tests/fixtures/representative-atomic.json")))))'], {encoding:'utf8'}));
const card = (name: string): Card => data.cards.find((c: Card) => c.name === name);
for (const [name, faces] of [
  ['Sol Ring',1], ['Necropotence',1], ['Sheoldred // The True Scriptures',2],
  ['Bala Ged Recovery // Bala Ged Sanctuary',2], ['Fire // Ice',2],
  ['Bonecrusher Giant // Stomp',2], ['Jace, the Mind Sculptor',1],
  ['The Eldest Reborn',1], ['Greater Morphling',1],
] as const) {
  test(`${name}: preserves every face, ability paragraph and dated ruling`, () => {
    const c = card(name), html = renderCard(c);
    assert.equal(c.faces.length, faces);
    assert.equal((html.match(/class="face"/g) ?? []).length, faces);
    for (const face of c.faces) {
      assert.ok(html.includes(escapeHtml(face.type)));
      for (const paragraph of face.text.split('\n')) assert.ok(html.includes(`<p>${renderSymbols(paragraph)}</p>`));
    }
    assert.equal((html.match(/class="ruling"/g) ?? []).length, c.rulings.length);
    for (const [date, text] of c.rulings) {
      assert.ok(html.includes(`datetime="${date}"`));
      assert.ok(html.includes(renderSymbols(text)));
    }
  });
}
test('representative structure checks: stats, ruling order, chapters and long text', () => {
  const necro = card('Necropotence');
  assert.ok(necro.rulings.length >= 3);
  assert.deepEqual(necro.rulings.map(r=>r[0]), necro.rulings.map(r=>r[0]).sort());
  assert.match(renderCard(card('Jace, the Mind Sculptor')), /Loyalty 3/);
  assert.match(renderCard(card('Sheoldred // The True Scriptures')), /4 \/ 5/);
  assert.match(renderCard(card('The Eldest Reborn')), /III —/);
  assert.ok(card('Greater Morphling').faces[0].text.length > 600);
  assert.ok(card('Greater Morphling').faces[0].text.split('\n').length > 5);
  assert.match(renderCard(card('Sol Ring')), /ms-tap/);
});
