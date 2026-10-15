import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../agent-queue.js',import.meta.url),'utf8');
const body=source.slice(source.indexOf('  async function preserveBeforeSwitch('),source.indexOf('  async function loadSelected('));
async function run({localFail=false,cloudFail=false,recoveryFail=false,photos=1,refs=photos,submitted=false,retired=false,cloud=true}={}){
  const calls=[];
  const context={window:{ECHStudio:{photoCount:()=>photos},ECHDrafts:{flush:async()=>{calls.push('device');if(localFail)throw new Error('The object can not be found here.');}},ECHCloud:cloud?{ready:async()=>{calls.push('recover');if(recoveryFail)throw new Error('Cloud recovery needs a retry.');},isSubmitted:()=>submitted,flush:async()=>{calls.push('cloud-save');if(cloudFail)throw new Error('Upload failed');return Array(refs).fill({confirmed:true});}}:null}};
  vm.createContext(context);vm.runInContext(body,context);
  try{return {result:await context.preserveBeforeSwitch(retired),calls};}catch(error){return {error,calls};}
}
const recovered=await run({localFail:true});assert.equal(recovered.result,true);assert.deepEqual(recovered.calls,['device','recover','cloud-save']);
assert.match((await run({localFail:true,cloudFail:true})).error.message,/Upload failed/);
assert.match((await run({localFail:true,recoveryFail:true})).error.message,/recovery needs/);
assert.match((await run({localFail:true,refs:0})).error.message,/confirmation is incomplete/);
assert.match((await run({localFail:true,cloud:false})).error.message,/no current cloud backup/);
assert.match((await run({localFail:true,submitted:true})).error.message,/no current cloud backup/);
assert.equal((await run()).result,false);
assert.equal((await run({localFail:true,photos:0,refs:0})).result,true);
assert.deepEqual((await run({retired:true,photos:0})).calls,['device']);
assert.match((await run({retired:true,photos:0,localFail:true})).error.message,/no current cloud backup/);
assert.match((await run({cloudFail:true})).error.message,/Upload failed/);
console.log('PASS 11 switch preservation cases: device object-not-found recovers through confirmed cloud; failed/incomplete recovery remains blocked.');
