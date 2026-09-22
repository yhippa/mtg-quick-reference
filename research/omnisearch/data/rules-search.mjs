// Promoted from the validated research engine. Keep scoring in one implementation.
import { normalize } from './card-search.mjs';
const stop = new Set('a an the of to and or in on at by for from with as is are was were be been being it its that this those these do does did can could would should how when what which who i you your my their they them after before'.split(' '));
export function tokens(text) { return normalize(text).split(' ').filter(t => t && !stop.has(t)); }
export function buildBM25(docs) {
    const postings = Object.create(null), lengths = [];
    docs.forEach((d, i) => {
        const title = tokens([d.title, ...(d.aliases ?? [])].join(' ')), body = tokens(d.text ?? '');
        const tf = new Map();
        for (const t of title)
            tf.set(t, (tf.get(t) ?? 0) + 3);
        for (const t of body)
            tf.set(t, (tf.get(t) ?? 0) + 1);
        lengths.push(title.length * 3 + body.length);
        for (const [t, n] of tf)
            (postings[t] ??= []).push(i, n);
    });
    return { version: 1, n: docs.length, avgLength: lengths.reduce((a, b) => a + b, 0) / docs.length, lengths, postings };
}
export function queryBM25(index, query, limit = 10, minDoc = 0) {
    const terms = [...new Set(tokens(query))];
    if (!terms.length)
        return [];
    const scores = new Map(), coverage = new Map();
    for (const term of terms) {
        const list = Object.hasOwn(index.postings, term) ? index.postings[term] : undefined;
        if (!list)
            continue;
        const idf = Math.log(1 + (index.n - list.length / 2 + .5) / (list.length / 2 + .5));
        for (let j = 0; j < list.length; j += 2) {
            const id = list[j], tf = list[j + 1];
            if (id < minDoc)
                continue;
            const score = idf * (tf * 2.2) / (tf + 1.2 * (.25 + .75 * index.lengths[id] / index.avgLength));
            scores.set(id, (scores.get(id) ?? 0) + score);
            coverage.set(id, (coverage.get(id) ?? 0) + 1);
        }
    }
    for (const [id, score] of scores)
        scores.set(id, score * (coverage.get(id) / terms.length) ** 2);
    return [...scores].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, limit).map(([i, score]) => ({ i, score }));
}
export const compactRule = ({ id, kind, key, title }) => ({ id, kind, key, title });
export function createRulesSearch(docs, index) {
    const direct = new Map(docs.map(d => [d.key.toLowerCase(), d]));
    const titles = new Map();
    for (const d of docs)
        if (d.kind !== 'rule') {
            const title = normalize(d.title);
            titles.set(title, [...(titles.get(title) ?? []), d]);
        }
    return (q) => {
        const number = q.trim().toLowerCase().replace(/^(?:cr|rules?)\s+/, '').replace(/\.$/, '');
        const d = /^\d{1,3}(?:\.\d+)?[a-z]?$/.test(number) ? direct.get(number) : undefined;
        return { direct: d ? [compactRule(d)] : [], exact: (titles.get(normalize(q)) ?? []).map(compactRule),
            ranked: queryBM25(index, q.replace(/^(?:cr|rules?)\s+/i, ''), 20).map(h => compactRule(docs[h.i])) };
    };
}
