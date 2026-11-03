import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {createHash} from 'node:crypto';
process.env.ECH_DRAFT_V29='1';
const {createSystem,origin}=await import('./system.mjs');const s=await createSystem();const core=createRequire(import.meta.url)('../../builder-core.js');
const tests=[];const ok=name=>{tests.push({name,status:'VERIFIED'});console.log('PASS '+name);};
const digest=b=>createHash('sha256').update(b).digest('hex');
function jpeg(i,size=64){const bytes=Buffer.alloc(size,i);Buffer.from([255,216,255,192,0,17,8,6,164,7,8,3,1,17,0,2,17,0,3,17,0,255,217]).copy(bytes);return new File([bytes],'synthetic-'+i+'.jpeg',{type:'image/jpeg'});}
async function call(job,mode,extra={}){const form=new FormData();if(mode)form.append('mode',mode);for(const[k,v]of Object.entries(extra))form.append(k,v);const r=await s.review(new Request(origin+'/review'+(mode==='original'?'?mode=original':''),{method:'POST',headers:{origin,authorization:'Bearer '+job.token},body:form}));return {status:r.status,body:await r.json()};}
function packet(job,refs){const item={...job.item,cond:'N1',quantityConfirmed:true};delete item.reviewToken;return {schemaVersion:1,queueId:job.id,reviewStatus:'awaiting_lee_approval',item,ebayTitle:core.ebayTitle(item),descriptionHtml:core.build(item),photoManifest:refs.map(ref=>({name:ref.originalName,width:ref.width,height:ref.height})),issues:[]};}
const submit=(job,refs)=>call(job,null,{listing:new Blob([JSON.stringify(packet(job,refs))],{type:'application/json'}),photoReferences:JSON.stringify(refs)});
try{
 const job=await s.seed({sku:'QA-MAXIMUM-PHOTOS'}),refs=[],originals=[];
 for(let i=0;i<24;i++){
  const upload=await call(job,'photo',{photo:jpeg(i)});assert.equal(upload.status,201);refs.push(upload.body.photo);
  if(i===0)s.failures.afterOriginalStore=true;
  const file=jpeg(i,i===0?32*1024*1024:1024*1024);
  const archived=await call(job,'original',{photo:file,normalizedSha256:refs[i].sha256});assert.equal(archived.status,201,JSON.stringify(archived));
  assert.equal(archived.body.original.sha256,digest(Buffer.from(await file.arrayBuffer())));originals.push(archived.body.original);
 }
 ok('24 photos and originals archive in order, including one exact 32MiB original');
 const count=(await s.db.query('select count(*)::int n from private.ech_original_photos where queue_id=$1',[job.id])).rows[0].n;assert.equal(count,24);
 ok('Lost original-storage response resolves by exact-byte readback with no duplicate original');
 const tooBig=await call(job,'original',{photo:jpeg(44,32*1024*1024+1),normalizedSha256:refs[0].sha256});assert.notEqual(tooBig.status,201);ok('Over-32MiB original is rejected without changing existing originals');
 const tooMany=await submit(job,[...refs,refs[0]]);assert.equal(tooMany.status,422);ok('25-photo review is rejected before review acceptance');
 s.failures.originalRead=true;assert.equal((await submit(job,refs)).status,422);
 s.failures.corruptOriginalRead=true;assert.equal((await submit(job,refs)).status,422);
 for(const original of originals)assert.equal(digest(await fs.readFile(s.diskPath('ech-original-photos/'+original.storagePath))),original.sha256);
 ok('Missing and corrupted readback block receipt; all24stored originals remain byte-identical');
 const accepted=await submit(job,refs);assert.equal(accepted.status,201,JSON.stringify(accepted));
 const replay=await submit(job,refs);assert.equal(replay.body.reviewId,accepted.body.reviewId);
 const rows=(await s.db.query('select display_order,sha256 from public.ech_listing_review_photos where review_id=$1 order by display_order',[accepted.body.reviewId])).rows;
 assert.deepEqual(rows.map(r=>r.sha256),refs.map(r=>r.sha256));assert.deepEqual(rows.map(r=>r.display_order),Array.from({length:24},(_,i)=>i));
 assert.equal((await s.db.query('select count(*)::int n from public.ech_listing_reviews where queue_id=$1',[job.id])).rows[0].n,1);
 ok('24-photo send and retry create exactly one review with exact photo ordering');
}finally{await s.close();await fs.mkdir(new URL('../runtime-evidence/',import.meta.url),{recursive:true});await fs.writeFile(new URL('../runtime-evidence/upload-boundaries.json',import.meta.url),JSON.stringify({scope:'synthetic padded image headers; backend bytes/limits only, not real HEIC/JPEG decoding or hosted performance',tests},null,2));}
