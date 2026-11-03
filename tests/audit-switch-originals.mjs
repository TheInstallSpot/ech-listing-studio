import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(process.env.AUDIT_QUEUE_SOURCE||new URL('../agent-queue.js',import.meta.url),'utf8');
const body=source.slice(source.indexOf('  async function preserveBeforeSwitch('),source.indexOf('  async function loadSelected('));
async function attempt({archiveFails=false,archived=1,submitted=false}={}){
 const calls=[];
 const c={window:{ECHStudio:{photoCount:()=>1,snapshotDraft:()=>({photos:[{originalAvailable:true}]})},ECHDrafts:{flush:async()=>{throw new DOMException('The object cannot be found','NotFoundError');}},ECHCloud:{ready:async()=>{},isSubmitted:()=>submitted,flush:async()=>[{sha256:'normalized-only'}],archiveOriginals:async()=>{calls.push('original-archive');if(archiveFails)throw Error('Original upload interrupted');return archived;}}},DOMException};
 vm.createContext(c);vm.runInContext(body,c);
 try{return {allowed:await c.preserveBeforeSwitch(false),calls};}catch(error){return {error:error.message,calls};}
}
const interrupted=await attempt({archiveFails:true});
assert.equal(interrupted.allowed,undefined,'Must not leave an item with failed local storage and unconfirmed original');
assert.match(interrupted.error,/Original upload interrupted/);
assert.match((await attempt({archived:0})).error,/original storage is incomplete/);
assert.equal((await attempt()).allowed,true);
assert.deepEqual((await attempt({submitted:true})).calls,[]);
console.log('PASS 4 independent switch/original cases: interrupted archive blocks, incomplete archive blocks, exact archive permits, received job can leave');
