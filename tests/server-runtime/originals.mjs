import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createSystem,origin,digest} from './system.mjs';import {randomUUID,createHash} from 'node:crypto';
const system=await createSystem();let passed=0;function ok(label,condition){assert.ok(condition,label);passed++;console.log('PASS '+label);}
function jpeg(w=1800,h=1700){return new File([new Uint8Array([255,216,255,192,0,17,8,h>>8,h&255,w>>8,w&255,3,1,17,0,2,17,0,3,17,0,255,217])],'camera.jpeg',{type:'image/jpeg'});}
async function call(job,mode,extra={}){const f=new FormData();f.append('mode',mode);for(const[k,v]of Object.entries(extra))f.append(k,v);const r=await system.review(new Request(origin+'/review'+(mode==='original'?'?mode=original':''),{method:'POST',headers:{origin,authorization:'Bearer '+job.token},body:f}));return {status:r.status,body:await r.json()};}
try{
 const a=await system.seed(),b=await system.seed({sku:a.sku});const normalized=await call(a,'photo',{photo:jpeg()});ok('Normalized review photo remains separate',normalized.status===201);
 const original=jpeg(4000,3000),sha=createHash('sha256').update(Buffer.from(await original.arrayBuffer())).digest('hex');
 const uploaded=await call(a,'original',{photo:original,normalizedSha256:normalized.body.photo.sha256});ok('Original archive confirms exact full-resolution bytes',uploaded.status===201&&uploaded.body.original.sha256===sha);
 const bytes=await fs.readFile(system.diskPath('ech-original-photos/'+uploaded.body.original.storagePath));ok('Private storage contains unchanged original bytes',bytes.equals(Buffer.from(await original.arrayBuffer())));
 const replay=await call(a,'original',{photo:original,normalizedSha256:normalized.body.photo.sha256});ok('Duplicate archive retries return the same original receipt',replay.status===201&&replay.body.original.id===uploaded.body.original.id);
 await assert.rejects(system.db.query("update private.ech_original_photos set original_name='changed'"));ok('Stored original receipt cannot be rewritten',true);
 await assert.rejects(system.db.query('delete from private.ech_original_photo_links'));ok('Original associations cannot be silently removed',true);
 const counts=await system.db.query('select count(*)::int n from private.ech_original_photos');ok('Replay cannot create duplicate original records',counts.rows[0].n===1);
 const draft=await call(a,'draft-save',{snapshot:JSON.stringify({item:a.item,photos:[normalized.body.photo]})});assert.equal(draft.status,200);
 const read=await call(a,'draft-read');ok('Active item recovers signed originals with raw hash and normalized mapping',read.status===200&&read.body.originals[0].sha256===sha&&read.body.originals[0].normalizedSha256===normalized.body.photo.sha256&&read.body.originals[0].signedUrl.includes('ech-original-photos'));
 const wrong=await call(b,'original',{photo:original,normalizedSha256:normalized.body.photo.sha256});ok('Different physical job cannot claim an existing normalized photo',wrong.status!==201);
 const spoof=await call(a,'original',{photo:new File(['<svg><script>x</script></svg>'],'fake.jpeg',{type:'image/jpeg'}),normalizedSha256:normalized.body.photo.sha256});ok('Image MIME or extension cannot disguise executable input',spoof.status!==201);
 const unknown=await call(a,'original',{photo:original,normalizedSha256:'e'.repeat(64)});ok('Originals cannot attach to missing review photos',unknown.status!==201);
 const bad=await system.seed({expiry:'-1 hour'});ok('Expired original upload permission fails closed',(await call(bad,'original',{photo:original,normalizedSha256:normalized.body.photo.sha256})).status===401);
 await system.db.query('update private.ech_review_tokens set used_at=now() where queue_id=$1',[a.id]);ok('Consumed permission cannot archive additional originals',(await call(a,'original',{photo:original,normalizedSha256:normalized.body.photo.sha256})).status!==201);
 const privilege=await system.db.query("select has_function_privilege('anon','public.read_ech_original_photos_v25(uuid[])','execute') a,has_function_privilege('authenticated','public.read_ech_original_photos_v25(uuid[])','execute') u");ok('Paige/public clients cannot query the original archive RPC directly',!privilege.rows[0].a&&!privilege.rows[0].u);
 const bucket=await system.db.query("select public,file_size_limit from storage.buckets where id='ech-original-photos'");ok('Original bucket is private and bounded to32MB',bucket.rows[0].public===false&&Number(bucket.rows[0].file_size_limit)===33554432);
 console.log(passed+' original archive integration checks passed; synthetic files only, no external network.');
}finally{await system.close();}
