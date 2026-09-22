// Incremental cost above the current complete card dataset + current name index.
import {readFileSync} from 'node:fs';
import {makeIndex,search} from './data/card-search.mjs';
import {buildBM25,queryBM25} from './engine.mjs';
import os from 'node:os';
const root=new URL('./',import.meta.url), read=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
const mode=process.argv[2]??'prebuilt';
const start=performance.now();
const cards=read('../../public/data/cards.json');
const names=makeIndex(cards.cards);
global.gc?.();const base=process.memoryUsage();const baseReady=performance.now();
const rules=read('data/corpus.json');
const loaded=performance.now();
const idx=mode==='prebuilt'?read('data/rules-index.json'):buildBM25(rules.documents);
const indexed=performance.now();global.gc?.();const mem=process.memoryUsage();
// Keep both datasets/indexes observably live through the memory measurement.
const sanity={card:cards.cards[search(names,'sol',1)[0]].name,rule:rules.documents[queryBM25(idx,'commander costs two more',1)[0].i].id};
console.log(JSON.stringify({mode,environment:{node:process.version,cpu:os.cpus()[0].model},baseline:{cardReadyMs:baseReady-start,heapBytes:base.heapUsed},incremental:{corpusReadParseMs:loaded-baseReady,indexMs:indexed-loaded,readyMs:indexed-baseReady,heapBytes:mem.heapUsed-base.heapUsed,rssBytes:mem.rss-base.rss},totalHeapBytes:mem.heapUsed,sanity},null,2));
