import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';
const source=fs.readFileSync(new URL('../cloud-draft.js',import.meta.url),'utf8');
const sha=async b=>Buffer.from(await webcrypto.subtle.digest('SHA-256',await b.arrayBuffer())).toString('hex');
async function run({missing=false,corrupt=false,wrongSize=false,mismatch=false}={}){
 const clean=new File(['clean review bytes'],'clean.jpeg',{type:'image/jpeg'}),original=new Blob(['exact full original bytes']),norm=await sha(clean),originalSha=await sha(original),calls=[];
 const stale={size:original.size,arrayBuffer:async()=>{throw new DOMException('The object can not be found here.','NotFoundError');}};
 const item={sku:'fixture-bracket',_draftId:'exact-physical-job',reviewToken:'fixture-only'},element=()=>({style:{},setAttribute(){},after(){},disabled:false,hidden:false});
 const studio={getState:()=>({...item}),photoCount:()=>1,exportPhotos:()=>[clean],snapshotDraft:()=>({item,photos:[{original:stale,originalAvailable:true}]})};
 let reads=0;const c={window:{ECH_REVIEW_ENDPOINT:'https://fixture.invalid/review',ECHStudio:studio,addEventListener(){}},document:{createElement:element,getElementById:element,addEventListener(){}},FormData,AbortController,crypto:webcrypto,setTimeout,clearTimeout,File,fetch:async(url,opt)=>{
  if(url==='https://fixture.invalid/original'){calls.push('read-original');return {ok:true,blob:async()=>corrupt?new Blob(['corrupted bytes']):original};}
  const mode=opt.body.get('mode');calls.push(mode);assert.equal(opt.headers.Authorization,'Bearer fixture-only');
  if(mode==='draft-read')return {ok:true,json:async()=>({snapshot:null,originals:++reads===1||missing?[]:[{normalizedSha256:norm,sha256:originalSha,sizeBytes:wrongSize?999:original.size,signedUrl:'https://fixture.invalid/original'}]})};
  throw Error('No upload or draft write is allowed during archived-original recovery');
 }};
 vm.createContext(c);vm.runInContext(source,c);await c.window.ECHCloud.ready();
 try{return {saved:await c.window.ECHCloud.archiveOriginals([{sha256:mismatch?'wrong-photo':norm}]),calls};}catch(error){return {error,calls};}
}
const ok=await run();assert.equal(ok.saved,1);assert.deepEqual(ok.calls,['draft-read','draft-read','read-original']);console.log('PASS stale iOS original handle uses full archived original only after exact photo link, size and SHA verification; no upload/delete/write');
assert.match((await run({missing:true})).error.message,/full cloud original is not confirmed/);console.log('PASS missing full original stays blocked; no normalized photo passed off as original');
assert.match((await run({corrupt:true})).error.message,/verification failed/);assert.match((await run({wrongSize:true})).error.message,/verification failed/);console.log('PASS corrupt bytes or wrong size cannot satisfy original preservation');
const changed=await run({mismatch:true});assert.match(changed.error.message,/Photos changed/);assert.deepEqual(changed.calls,['draft-read']);console.log('PASS different visible photo cannot reuse an unrelated archived original');
