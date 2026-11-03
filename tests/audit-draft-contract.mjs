import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';import {createRequire} from 'node:module';
const created=[];const element=()=>{const e={style:{},setAttribute(){},after(){},disabled:false,hidden:false};created.push(e);return e;};
const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
const item={sku:'QA-REVISION',_draftId:'qa-only',reviewToken:'fixture-only'},files=[new File(['first'],'a.jpeg',{type:'image/jpeg'}),new File(['second'],'b.jpeg',{type:'image/jpeg'})];
let revision=7,loseReply=false,offline=false,saved={_revision:7,item,photos:[]};const bases=[];
const c={window:{ECH_REVIEW_ENDPOINT:'https://fixture.invalid',addEventListener(){},ECHStudio:{getState:()=>({...item}),exportPhotos:()=>files,photoCount:()=>2,restoreCloud:async()=>{},snapshotDraft:()=>({item,photos:files.map(original=>({original,originalAvailable:true}))})}},document:{createElement:element,getElementById:el,addEventListener(){}},FormData,File,AbortController,crypto:webcrypto,setTimeout,clearTimeout,fetch:async(url,opt)=>{
 const mode=opt.body.get('mode');
 if(offline)throw Error('Network interrupted');
 if(mode==='draft-read')return {ok:true,json:async()=>({snapshot:saved,originals:[]})};
 if(mode==='photo')return {ok:true,json:async()=>({photo:{sha256:Buffer.from(await webcrypto.subtle.digest('SHA-256',await opt.body.get('photo').arrayBuffer())).toString('hex')}})};
 if(mode==='draft-save'){
  const snapshot=JSON.parse(opt.body.get('snapshot'));bases.push(snapshot._baseRevision);
  if(snapshot._mutationId===saved._mutationId)return {ok:true,json:async()=>({snapshot:saved,saved:true})};
  if(snapshot._baseRevision!==revision)return {ok:false,status:409,json:async()=>({code:'draft_revision_conflict',error:'Newer cloud work exists. Keep this page open.'})};
  revision++;saved={...snapshot,_revision:revision};if(loseReply){loseReply=false;throw Error('Simulated lost save response');}
  return {ok:true,json:async()=>({snapshot:saved,saved:true})};
 }
 throw Error('Unexpected request '+mode);
}};
vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../cloud-draft.js',import.meta.url),'utf8'),c);
await c.window.ECHCloud.ready();await c.window.ECHCloud.flush();assert.deepEqual(bases,[7,8]);
loseReply=true;await c.window.ECHCloud.flush();assert.equal(revision,11);
offline=true;await assert.rejects(c.window.ECHCloud.flush(),/Network interrupted/);assert.equal(files.length,2);
offline=false;await c.window.ECHCloud.flush();
revision++;saved={...saved,_revision:revision,_mutationId:'another-device'};
await assert.rejects(c.window.ECHCloud.flush(),/Newer cloud work/);assert.equal(files.length,2);
assert.match(created.find(e=>e.id==='cloudSaveStatus').textContent,/Newer cloud work/);
console.log('PASS partial revisions, lost-reply automatic recovery, interrupted-network retry and real concurrent-conflict protection; originals retained');
const queue=fs.readFileSync(new URL('../agent-queue.js',import.meta.url),'utf8');const auth=queue.slice(queue.indexOf('  function authorization('),queue.indexOf('  function read('));
const a={window:{ECHAuthorization:{check:()=>({allowed:true})},ECHCore:createRequire(import.meta.url)('../builder-core.js')}};
vm.createContext(a);vm.runInContext(auth,a);
assert.equal(a.authorization({brand:'Fixture',part:'QA-100',what:'A'.repeat(100),sold:'Each'}).allowed,false);
assert.equal(a.authorization({brand:'Fixture',part:'QA-100',what:'Speaker',sold:'Each'}).allowed,true);
console.log('PASS unknown overlong prepared title blocks before capture; ordinary title remains available');
