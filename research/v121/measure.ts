import {readFileSync,writeFileSync} from 'node:fs';
import {createRuleDetails} from '../../src/rule-family.ts';
import {renderRule} from '../../src/rules-detail.ts';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const corpus=read('public/data/rules.json'),release=read('public/data/rules-release.json');
const before=read('research/v121/baseline.json'),after=read('research/v121/production.json');
const detail=createRuleDetails(corpus.documents);
const pct=(xs:number[])=>{xs.sort((a,b)=>a-b);return {p50:xs[Math.floor(xs.length*.5)],p95:xs[Math.floor(xs.length*.95)]};};
const families=['cr:702.22','cr:702.22a','cr:601','cr:601.2'].map(id=>{
 const lookup:number[]=[],render:number[]=[],clone:number[]=[];
 for(let i=0;i<300;i++){let t=performance.now();const d=detail(id)!;lookup.push(performance.now()-t);t=performance.now();structuredClone(d);clone.push(performance.now()-t);t=performance.now();renderRule(d,release);render.push(performance.now()-t);}
 const d=detail(id)!;return {id,members:d.family!.members.length,responseJsonBytes:Buffer.byteLength(JSON.stringify(d)),lookupMs:pct(lookup),structuredCloneMs:pct(clone),renderHtmlMs:pct(render)};
});
const report={note:'Node on this Mac, 300 warm iterations. HTML generation excludes browser layout; structuredClone approximates serialization, not worker scheduling. No physical-phone timing claim.',families,production:after,comparison:{startupBefore:before.startup,startupAfter:after.startup,warmBefore:before.warm,warmAfter:after.warm,unchangedData:['data/cards.json','data/rules.json','data/rules-index.json'].map(path=>({path,identical:before.sizes[path].sha256===after.sizes[path].sha256,bytes:after.sizes[path].bytes})),assetsBefore:Object.entries(before.sizes).filter(([p])=>p.startsWith('assets/')),assetsAfter:Object.entries(after.sizes).filter(([p])=>p.startsWith('assets/'))}};
writeFileSync('research/v121/performance.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({families,comparison:report.comparison},null,2));
