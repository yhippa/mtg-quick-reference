import {run} from './browser-runner.mjs';
self.onmessage=async e=>{try{self.postMessage({result:await run(e.data)});}catch(error){self.postMessage({error:String(error)});}};
