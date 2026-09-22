import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRuleDetails,isReadingFamily} from '../src/rule-family.ts';
import {renderRule,ruleAnchorId} from '../src/rules-detail.ts';
import {referenceUrl,readRoute} from '../src/omnisearch.ts';
import type {RuleDocument} from '../src/rules-types.ts';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const documents:RuleDocument[]=read('public/data/rules.json').documents;
const release=read('public/data/rules-release.json');
const detail=createRuleDetails(documents);
test('Banding family retains all 12 direct documents in source order and their exact provenance',()=>{
 const d=detail('cr:702.22')!;
 const expected=documents.filter(d=>d.parentId==='cr:702.22').sort((a,b)=>a.order-b.order);
 assert.equal(expected.length,12);
 assert.deepEqual(d.family!.members.map(m=>m.document),expected);
 assert.equal(d.parent!.id,'cr:702');assert.deepEqual(d.children,[]);
 const html=renderRule(d,release);
 assert.equal((html.match(/class="family-member/g)??[]).length,12);
 assert.ok(!html.includes('aria-label="Subrules"'));
 for(const doc of expected)assert.ok(html.includes(`${doc.key} · source lines ${doc.sourceLines.join('–')}`));
});
test('exact child identity, snapshot URL and highlight survive family presentation',()=>{
 for(const id of ['cr:702.22a','cr:702.22g','cr:702.22m']){
  const d=detail(id)!;assert.equal(d.document.id,id);assert.equal(d.family!.root.id,'cr:702.22');
  const html=renderRule(d,release);
  assert.ok(html.includes(`class="family-member focused-rule" id="${ruleAnchorId(id)}"`));
  assert.equal((html.match(/aria-current="location"/g)??[]).length,1);
  assert.deepEqual(readRoute(referenceUrl(release.source.sha256,id)),{kind:'rule',snapshot:release.source.sha256,id});
 }
});
test('glossary explicit Banding reference leads directly to the complete family',()=>{
 const glossary=documents.find(d=>d.kind==='glossary'&&d.references.includes('cr:702.22'))!;
 assert.ok(renderRule(detail(glossary.id)!,release).includes(encodeURIComponent('cr:702.22')));
 assert.equal(detail('cr:702.22')!.family!.members.length,12);
});
test('Casting Spells uses actual hierarchy; nested families stay directly reachable',()=>{
 const casting=detail('cr:601')!;
 assert.equal(casting.family!.members.length,8);assert.equal(casting.parent!.id,'cr:6');
 assert.equal(detail('cr:601.2')!.family!.members.length,9);
 assert.equal(detail('cr:601.2a')!.family!.root.id,'cr:601.2');
 assert.equal(detail('cr:601.4')!.family!.root.id,'cr:601');
 assert.ok(renderRule(casting,release).includes('Subrules of 601.2 →'));
 for(const id of ['cr:702','cr:6','cr:716.2'])assert.equal(detail(id)!.family,undefined);
 const leaf=detail('cr:716.2a')!;assert.equal(leaf.family,undefined);
 assert.ok(renderRule(leaf,release).includes('rule-body'));
});
test('family detection is independent of numbering and input array order; mixed groups fall back',()=>{
 const base=documents.find(d=>d.id==='cr:702.22a')!;
 const root={...base,id:'renamed-root',key:'anything',parentId:null,text:'Heading'};
 const a={...base,id:'alpha',parentId:root.id,order:1},b={...base,id:'beta',parentId:root.id,order:2};
 assert.deepEqual(createRuleDetails([b,root,a])(root.id)!.family!.members.map(m=>m.document.id),['alpha','beta']);
 assert.equal(isReadingFamily([a,{...b,text:'Another heading'}]),false);
 assert.equal(isReadingFamily([a,{...b,kind:'section'}]),false);
 assert.equal(createRuleDetails([root,a,{...b,text:'Introduction:'}])(a.id)!.family,undefined);
 assert.equal(detail('missing'),null);
});
