import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('../agent-queue.js',import.meta.url),'utf8');
const body=src.slice(src.indexOf('  async function preserveBeforeSwitch('),src.indexOf('  async function loadSelected('));
async function attempt({receipt=true,retired=true}={}){
 let submitted=false;const calls=[];
 const c={window:{ECHStudio:{photoCount:()=>3,waitForPhotos:async()=>{},unreadablePhotoCount:()=>0},ECHDrafts:{flush:async()=>{calls.push('local');throw new Error('The object can not be found here.');}},ECHCloud:{isSubmitted:()=>submitted,ready:async()=>{calls.push('read');throw Error('expired permission');},retryRecovery:async()=>{calls.push('receipt');if(!receipt)throw Error('No durable receipt');submitted=true;},flush:async()=>{throw Error('Must not write to completed job');}}}};
 vm.createContext(c);vm.runInContext(body,c);
 try{return {result:await c.preserveBeforeSwitch(retired),calls};}catch(e){return {error:e.message,calls};}
}
const ok=await attempt();assert.equal(ok.result,true);assert.deepEqual(ok.calls,['local','read','receipt']);
assert.match((await attempt({receipt:false})).error,/No durable receipt/);
console.log('PASS stale device originals on retired job unlock only after durable receipt; no retired upload or deletion');
