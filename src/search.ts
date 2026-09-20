export interface Face { name: string; mana?: string; type: string; text: string; power?: string; toughness?: string; loyalty?: string; defense?: string }
export interface Card { rank?: number; name: string; faces: Face[]; rulings: [string, string][] }
export interface Dataset { schema: number; updated: string; source: string; cards: Card[] }
export function normalize(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
export function makeIndex(cards: Card[]) {
  return cards.map((card, id) => ({ id, rank: card.rank ?? 999999, names: [...new Set([card.name, ...card.faces.map(f => f.name)].map(normalize))].map(name => ({ name, words: name.split(' ') })) }));
}
export function search(index: ReturnType<typeof makeIndex>, query: string, limit = 20): number[] {
  const q = normalize(query);
  if (!q) return [];
  const tokens = q.split(' ');
  const hits: { id: number; score: number; length: number; rank: number }[] = [];
  for (const entry of index) {
    let best = Infinity;
    let length = Infinity;
    for (const { name, words } of entry.names) {
      const score = name === q ? 0 : name.startsWith(q + ' ') ? 1 :
        words.includes(q) ? 2 : name.startsWith(q) ? 3 : words.some(w => w.startsWith(q)) ? 4 :
        tokens.every(t => words.some(w => w.startsWith(t))) ? 5 : name.includes(q) ? 6 : Infinity;
      if (score < best || (score === best && name.length < length)) { best = score; length = name.length; }
    }
    if (best < Infinity) hits.push({ id: entry.id, score: best, length, rank: entry.rank });
  }
  return hits.sort((a, b) => a.score - b.score || a.rank - b.rank || a.length - b.length || a.id - b.id).slice(0, limit).map(h => h.id);
}
