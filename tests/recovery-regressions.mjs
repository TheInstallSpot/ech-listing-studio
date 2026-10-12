import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

// Run the actual autosave body with a full legacy cache. The independent
// photo store must still be notified; testing the old code fails this case.
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const saveBody=app.slice(app.indexOf('  function save(){'),app.indexOf('  function restore(){'));
let changed=0;
const legacy={state:()=>({sku:'TWIN'}),localStorage:{setItem(){throw new Error('Quota exceeded');}},document:{dispatchEvent(){changed++;}},Event};
vm.createContext(legacy);vm.runInContext(saveBody+'save();',legacy);
assert.equal(changed,1);console.log('PASS legacy cache failure still triggers durable photo persistence');

// Run the complete cloud-save client with identical photo bytes and SKU but
// separate physical jobs. Each permission must receive its own upload.
const events={},uploads=[],snapshots=[];
let item={sku:'TWIN',_draftId:'physical-A',reviewToken:'fixture-A'};
const file=new Blob(['identical camera bytes'],{type:'image/jpeg'});
const element=()=>({style:{},setAttribute(){},after(){},disabled:false,hidden:false});
const cx={window:{ECH_REVIEW_ENDPOINT:'https://mock.invalid/review',ECHStudio:{getState:()=>({...item}),photoCount:()=>1,exportPhotos:()=>[file]}},document:{createElement:element,getElementById:element,addEventListener:(n,f)=>events[n]=f},FormData,AbortController,crypto:webcrypto,setTimeout,clearTimeout,File:globalThis.File,fetch:async(url,opt)=>{
 const mode=opt.body.get('mode'),token=opt.headers.Authorization;
 if(mode==='photo'){uploads.push(token);return {ok:true,json:async()=>({photo:{id:'photo-'+token,sha256:'fixture'}})};}
 if(mode==='draft-save'){snapshots.push({token,snapshot:JSON.parse(opt.body.get('snapshot'))});return {ok:true,json:async()=>({saved:true})};}
 return {ok:true,json:async()=>({snapshot:null})};
}};
cx.window.addEventListener=()=>{};
vm.createContext(cx);vm.runInContext(fs.readFileSync(new URL('../cloud-draft.js',import.meta.url),'utf8'),cx);
await cx.window.ECHCloud.ready();await cx.window.ECHCloud.flush();
item={sku:'TWIN',_draftId:'physical-B',reviewToken:'fixture-B'};
await events['ech:loadPrepared']();await cx.window.ECHCloud.ready();await cx.window.ECHCloud.flush();
assert.deepEqual(uploads,['Bearer fixture-A','Bearer fixture-B']);
assert.equal(snapshots[1].snapshot.photos[0].id,'photo-Bearer fixture-B');
assert.ok(snapshots.every(s=>!s.snapshot.item.reviewToken));
console.log('PASS same-SKU identical photos remain isolated by physical job and permission');
await cx.window.ECHCloud.flush();assert.equal(uploads.length,2);
console.log('PASS retry on the same job reuses only its own acknowledged photo');

// Exercise the real queue retirement function, including ambiguous legacy jobs.
const queue=fs.readFileSync(new URL('../agent-queue.js',import.meta.url),'utf8');
const retire=queue.slice(queue.indexOf('  function removeSubmitted('),queue.indexOf("  $('sendToLee').addEventListener"));
const q={items:[{_queueId:'physical-A',sku:'TWIN'},{_queueId:'physical-B',sku:'TWIN'},{sku:'TWIN'}],write(){}};
vm.createContext(q);vm.runInContext(retire+"removeSubmitted('physical-A');",q);
assert.equal(q.items.length,2);assert.equal(q.items[0]._queueId,'physical-B');
vm.runInContext("removeSubmitted('');",q);assert.equal(q.items.length,2);
console.log('PASS sending one physical job preserves its same-SKU sibling and ambiguous legacy row');
console.log('4 recovery regression checks passed.');
