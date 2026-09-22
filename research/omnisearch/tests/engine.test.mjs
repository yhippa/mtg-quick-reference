import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildBM25,queryBM25,createEngine} from '../engine.mjs';
const root=new URL('../',import.meta.url),read=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
const rules=read('data/lean-rules.json'),cards=read('data/cards.json');
test('prebuilt and runtime indexes yield identical query rankings',()=>{
 const stored=read('data/rules-index.json'),built=buildBM25(rules);
 for(const c of read('evaluation.json').cases)assert.deepEqual(queryBM25(stored,c.query),queryBM25(built,c.query));
});
test('routed lookup preserves exact identifiers, card names, faces and glossary titles',()=>{
 const engine=createEngine('split',rules,cards,read('data/rules-index.json'));
 assert.equal(engine.search('117.3b')[0].id,'cr:117.3b');
 assert.equal(engine.search('CR 903.8')[0].id,'cr:903.8');
 assert.equal(engine.search('Sol Ring')[0].title,'Sol Ring');
 assert.equal(engine.search('The True Scriptures')[0].title,'Sheoldred // The True Scriptures');
 assert.equal(engine.search('Deathtouch')[0].id,'glossary:deathtouch');
 assert.equal(engine.search('zzzxxyy').length,0);
 assert.equal(engine.search('').length,0);
});
