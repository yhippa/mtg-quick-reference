import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync('src/main.ts','utf8');
test('normal app UI contains no manual update affordance or forced activation/reload path',()=>{
 assert.ok(!/id="update"|Update ready|controllerchange|postMessage\('ACTIVATE'\)|location\.reload/.test(source));
 const worker=readFileSync('scripts/build-sw.mjs','utf8');
 assert.ok(!/self\.skipWaiting\(|clients\.claim\(/.test(worker));
 assert.ok(!readFileSync('src/style.css','utf8').includes('#update'));
});
test('registration and waiting installation stay silent and do not navigate active clients',async()=>{
 // Execute the actual application lifecycle function with browser event doubles.
 const functionSource=source.slice(source.indexOf('async function setupOffline()'),source.indexOf("window.addEventListener('online', connectionStatus)"))
   .replace('import.meta.env.PROD','true');
 const handlers:Record<string,Function>={},workerHandlers:Record<string,Function>={};
 const status={textContent:'● Available offline'};let reloads=0,registrations=0,statusCalls=0;
 const worker={state:'installing',addEventListener:(type:string,fn:Function)=>workerHandlers[type]=fn};
 const registration={active:{},waiting:null as any,installing:worker,addEventListener:(type:string,fn:Function)=>handlers[type]=fn};
 const context:any={cached:false,el:(id:string)=>{assert.equal(id,'offline');return status;},connectionStatus:()=>statusCalls++,
  location:{reload:()=>reloads++},navigator:{serviceWorker:{register:async(path:string)=>{assert.equal(path,'./sw.js');registrations++;return registration;},ready:Promise.resolve(registration),addEventListener:()=>assert.fail('No controller-change reload listener')}}};
 await runInNewContext(functionSource+';setupOffline()',context);
 assert.equal(registrations,1);assert.equal(context.cached,true);
 handlers.updatefound();worker.state='installed';registration.waiting=worker;workerHandlers.statechange();
 assert.equal(status.textContent,'● Available offline');assert.equal(reloads,0);
 worker.state='redundant';workerHandlers.statechange();assert.equal(status.textContent,'● Available offline');
 assert.equal(statusCalls,2); // only initial status and ready; no update notification
 registration.active=null as any;workerHandlers.statechange();assert.match(status.textContent,/Offline save failed/); // first-install failure still visible
});
