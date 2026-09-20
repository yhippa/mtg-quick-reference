import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { makeIndex, search } from '../src/search.ts';
const start = performance.now();
const data = JSON.parse(readFileSync('public/data/cards.json', 'utf8'));
const parsed = performance.now();
const index = makeIndex(data.cards);
const indexed = performance.now();
const queries = ['b', 'bo', 'bol', 'bolt', 's', 'sheold', 'lightning bolt', 'urzas', 'fire ice', 'xyzxyz'];
const timings: number[] = [];
for (let n = 0; n < 30; n++) for (const query of queries) {
  const before = performance.now(); search(index, query); timings.push(performance.now() - before);
}
timings.sort((a,b) => a-b);
console.log(JSON.stringify({cards:data.cards.length, readParseMs:parsed-start, indexMs:indexed-parsed, searchMedianMs:timings[Math.floor(timings.length*.5)], searchP95Ms:timings[Math.floor(timings.length*.95)], results: ['sol','bolt','sheold'].map(q=>({query:q,names:search(index,q,5).map(i=>data.cards[i].name)}))}, null, 2));
