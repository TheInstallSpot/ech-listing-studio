import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const source=fs.readFileSync(new URL('../cloud-draft.js',import.meta.url),'utf8');
async function fixture({permanent=false,late=false}={}){
 const events={},elements=new Map(),writes=[],photo=new File(['retained photo bytes'],'retained.jpeg',{type:'image/jpeg'});
 let allowed=false,reads=0,release;
 const item={sku:'fixture-enclosure',_draftId:'physical-fixture',reviewToken:'fixture-only'};
 function element(){return {style:{},setAttribute(){},after(){},disabled:false,hidden:false,textContent:''};}
 function el(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}
 const c={window:{ECH_REVIEW_ENDPOINT:'https://fixture.invalid/review',ECHStudio:{getState:()=>({...item}),photoCount:()=>1,exportPhotos:()=>[photo]}},document:{createElement:element,getElementById:el,addEventListener:(n,f)=>events[n]=f},FormData,AbortController,crypto:webcrypto,setTimeout,clearTimeout,File,fetch:async(url,opt)=>{
  const mode=opt.body.get('mode');
  if(mode==='draft-read'){
   reads++;
   if(late&&reads===1)await new Promise(r=>release=r);
   if(permanent||(!allowed)||reads===1)return {ok:false,json:async()=>({error:'Permission was unavailable before reconnect'})};
   return {ok:true,json:async()=>({snapshot:null})};
  }
  if(mode==='photo')return {ok:true,json:async()=>({photo:{sha256:'fixture-sha',id:'fixture-photo'}})};
  if(mode==='draft-save'){writes.push(JSON.parse(opt.body.get('snapshot')));return {ok:true,json:async()=>({saved:true})};}
  throw Error('unexpected mode '+mode);
 }};
 c.window.addEventListener=(n,f)=>events[n]=f;vm.createContext(c);vm.runInContext(source,c);
 return {cloud:c.window.ECHCloud,events,el,writes,allow(){allowed=true;},reads:()=>reads,release(){release();}};
}
const a=await fixture();await assert.rejects(a.cloud.ready(),/recovery needs/);assert.equal(a.el('takePhoto').disabled,true);
a.allow();a.events['ech:queueSynced']();await new Promise(setImmediate);await a.cloud.ready();assert.equal(a.el('takePhoto').disabled,false);assert.equal(a.reads(),2);
await a.cloud.flush();assert.equal(a.writes.at(-1).photos.length,1);assert.equal(a.writes.at(-1).item.sku,'fixture-enclosure');assert.equal(a.writes.at(-1).item.reviewToken,undefined);
console.log('PASS reconnect retries failed recovery and unlocks camera only after fresh server confirmation; existing photo retained and saved');
const b=await fixture({permanent:true});await assert.rejects(b.cloud.ready());await assert.rejects(b.cloud.retryRecovery(),/could not be confirmed/);assert.equal(b.reads(),2);assert.equal(b.el('takePhoto').disabled,true);assert.equal(b.writes.length,0);
console.log('PASS persistent failure remains locked after one retry; no empty draft overwrite');
const c=await fixture({late:true});c.allow();c.events['ech:queueSynced']();c.release();await new Promise(setImmediate);await c.cloud.ready();assert.equal(c.reads(),2);assert.equal(c.el('choosePhoto').disabled,false);
console.log('PASS queue acceptance during in-flight failed read still triggers one fresh recovery');
const d=await fixture();await assert.rejects(d.cloud.ready());d.allow();await d.cloud.retryRecovery();await d.cloud.flush();assert.equal(d.reads(),2);assert.equal(d.writes.at(-1).photos.length,1);
console.log('PASS switch retry confirms recovery before preserving existing photos');
