import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../agent-queue.js',import.meta.url),'utf8');
const update=source.slice(source.indexOf('  async function updateSafely('),source.indexOf('  function checkAppUpdate('));
async function attempt(localFailure,cloudFailure){const calls=[],button={};const c={window:{ECHStudio:{waitForPhotos:async()=>calls.push('decode')},ECHDrafts:{flush:async()=>{calls.push('local');if(localFailure)throw Error('Quota');}}},preserveBeforeSwitch:async()=>{calls.push('cloud-originals');if(cloudFailure)throw Error('No cloud copy');},location:{pathname:'/paige/',assign:url=>calls.push(url)},status:message=>calls.push(message)};vm.createContext(c);vm.runInContext(update,c);await c.updateSafely('24rc19-slots1',button);return {calls,button};}
assert.deepEqual((await attempt(false,true)).calls,['decode','local','/paige/?release=24rc19-slots1']);
assert.deepEqual((await attempt(true,false)).calls,['decode','local','cloud-originals','/paige/?release=24rc19-slots1']);
const blocked=await attempt(true,true);assert.ok(!blocked.calls.some(c=>c.startsWith('/paige/')));assert.equal(blocked.button.disabled,false);
console.log('PASS safe update waits for decode and durable local originals; cloud-original fallback works; no saved copy means no navigation');
const listener={},writes=[],deletes=[];let pending;
const ctx={self:{location:{origin:'https://fixture.invalid'},clients:{claim:async()=>{}},addEventListener:(k,fn)=>listener[k]=fn},URL,Response,caches:{open:async()=>({put:async()=>writes.push(true)}),keys:async()=>['other-app','ech-old'],delete:async k=>deletes.push(k)},fetch:async()=>new Response('private-original')};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8'),ctx);
listener.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(deletes,[]);
listener.fetch({request:{method:'GET',url:'https://storage.fixture.invalid/signed-original?token=synthetic'},respondWith:p=>pending=p});await pending;assert.deepEqual(writes,[]);
console.log('PASS service-worker activation retains old/other caches and never caches signed cross-origin originals');
