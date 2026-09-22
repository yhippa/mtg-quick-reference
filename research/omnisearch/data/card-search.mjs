export function normalize(value) {
    return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
export function makeIndex(cards) {
    return cards.map((card, id) => ({ id, rank: card.rank ?? 999999, names: [...new Set([card.name, ...card.faces.map(f => f.name)].map(normalize))].map(name => ({ name, words: name.split(' ') })) }));
}
export function search(index, query, limit = 20) {
    const q = normalize(query);
    if (!q)
        return [];
    const tokens = q.split(' ');
    const hits = [];
    for (const entry of index) {
        let best = Infinity;
        let length = Infinity;
        for (const { name, words } of entry.names) {
            const score = name === q ? 0 : name.startsWith(q + ' ') ? 1 :
                words.includes(q) ? 2 : name.startsWith(q) ? 3 : words.some(w => w.startsWith(q)) ? 4 :
                    tokens.every(t => words.some(w => w.startsWith(t))) ? 5 : name.includes(q) ? 6 : Infinity;
            if (score < best || (score === best && name.length < length)) {
                best = score;
                length = name.length;
            }
        }
        if (best < Infinity)
            hits.push({ id: entry.id, score: best, length, rank: entry.rank });
    }
    return hits.sort((a, b) => a.score - b.score || a.rank - b.rank || a.length - b.length || a.id - b.id).slice(0, limit).map(h => h.id);
}
/** One edit (including swapped neighbors), deliberately conservative for short names. */
function near(a, b) {
    if (a === b)
        return true;
    if (Math.abs(a.length - b.length) > 1)
        return false;
    let i = 0;
    while (i < a.length && a[i] === b[i])
        i++;
    if (a.length === b.length)
        return a.slice(i + 1) === b.slice(i + 1) ||
            (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
    return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}
export function suggest(index, query, limit = 5) {
    const q = normalize(query);
    if (q.length < 4 || q.length > 100 || search(index, q, 1).length)
        return [];
    const hits = index.filter(entry => entry.names.some(({ name, words }) => near(q, name) || (!q.includes(' ') && words.some(word => near(q, word)))));
    return hits.sort((a, b) => a.rank - b.rank || a.id - b.id).slice(0, limit).map(e => e.id);
}
