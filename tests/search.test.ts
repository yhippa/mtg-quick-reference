import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, makeIndex, search, type Card } from '../src/search.ts';
const card = (name: string, faces = [name]): Card => ({ name, faces: faces.map(name => ({ name, type: '', text: '' })), rulings: [] });
const cards = [card('Thunderbolt'), card('Lightning Bolt'), card('Bolt'), card('Bolt Bend'), card('Sheoldred, the Apocalypse'), card('Sheoldred'), card('Fire // Ice', ['Fire', 'Ice']), card("Urza’s Saga")];
const index = makeIndex(cards);
const names = (q: string) => search(index, q).map(i => cards[i].name);
test('normalization folds case, accents, apostrophes, punctuation and spaces', () => {
  assert.equal(normalize('  Éowyn,  Shieldmaiden! '), 'eowyn shieldmaiden');
  assert.equal(normalize("Urza’s Saga"), normalize('Urzas saga'));
  assert.equal(normalize('Æther-Gust'), 'aether gust');
});
test('exact, prefix, word, substring ranking', () => assert.deepEqual(names('bolt'), ['Bolt', 'Bolt Bend', 'Lightning Bolt', 'Thunderbolt']));
test('prefix surfaces Sheoldred immediately', () => assert.deepEqual(names('SHEOLD'), ['Sheoldred', 'Sheoldred, the Apocalypse']));
test('back faces, partial words and punctuation search', () => {
  assert.equal(names('ice')[0], 'Fire // Ice');
  assert.equal(names('light b')[0], 'Lightning Bolt');
  assert.equal(names('urzas')[0], 'Urza’s Saga');
});
test('empty, unknown and result limit', () => {
  assert.deepEqual(search(index, ' !!! '), []);
  assert.deepEqual(search(index, 'notacard'), []);
  assert.equal(search(index, 'bolt', 2).length, 2);
});
test('popularity breaks ties but never overrides an exact match', () => {
  const popular = [card('Bolt'), {...card('Lightning Bolt'), rank: 1}, {...card('Tax Bolt'), rank: 200}];
  assert.deepEqual(search(makeIndex(popular), 'bolt'), [0, 1, 2]);
});
test('complete snapshot keeps Lightning Bolt and Sheoldred easy to find', async () => {
  const { readFileSync } = await import('node:fs');
  const dataset = JSON.parse(readFileSync(new URL('../public/data/cards.json', import.meta.url), 'utf8'));
  const realIndex = makeIndex(dataset.cards);
  const matches = (q: string) => search(realIndex, q, 5).map(i => dataset.cards[i].name);
  assert.ok(matches('sol').includes('Sol Ring'));
  assert.ok(matches('bolt').includes('Lightning Bolt'));
  assert.ok(matches('sheold').includes('Sheoldred, the Apocalypse'));
  assert.ok(matches('true scriptures').includes('Sheoldred // The True Scriptures'));
});
test('typo fallback supports missing, extra, replaced and transposed letters', async () => {
  const { suggest } = await import('../src/search.ts');
  for (const q of ['lightnng bolt','lightningg bolt','lightnimg bolt','lightnign bolt']) {
    assert.equal(cards[suggest(index, q)[0]].name, 'Lightning Bolt');
  }
  assert.equal(cards[suggest(index, 'sheolred')[0]].name, 'Sheoldred, the Apocalypse');
  assert.deepEqual(suggest(index, 'bolt'), []);
  assert.deepEqual(suggest(index, 'bol'), []);
  assert.deepEqual(suggest(index, 'zzzzzzzzzz'), []);
});
