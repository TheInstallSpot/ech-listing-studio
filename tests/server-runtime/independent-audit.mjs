// Current deployed Edge source and RPC snapshots. All storage/network is isolated.
import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes,createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
import {createSystem,origin,digest} from './system.mjs';
const system=await createSystem(), dir=new URL('../audit-deployed/',import.meta.url);
const core=createRequire(import.meta.url)('../../builder-core.js');
const results=[];
const record=(name,status,detail)=>{results.push({name,status,detail});console.log(status+' '+name+': '+detail);};
function load(source,extra=''){
 let handler;
 const c={Request,Response,Headers,FormData,File,Blob,URL,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortSignal,setTimeout,clearTimeout,crypto:webcrypto,fetch:system.bridge,console:{info(){}},Deno:{env:{get:n=>({SUPABASE_URL:origin,SUPABASE_SERVICE_ROLE_KEY:'synthetic-only',ECH_STUDIO_ORIGIN:origin})[n]},serve:fn=>handler=fn}};
 vm.createContext(c);new vm.Script(stripTypeScriptTypes(extra+'\n'+source.replace(/^import[^\n]+\n/gm,''),{mode:'strip'})).runInContext(c);return handler;
}
const jpeg=(name='qa.jpeg')=>new File([new Uint8Array([255,216,255,192,0,17,8,6,164,7,8,3,1,17,0,2,17,0,3,17,0,255,217])],name,{type:'image/jpeg'});
let review;
async function call(job,mode,extra={}){const f=new FormData();if(mode)f.append('mode',mode);for(const[k,v]of Object.entries(extra))f.append(k,v);const r=await review(new Request(origin+'/review'+(mode==='original'?'?mode=original':''),{method:'POST',headers:{origin,authorization:'Bearer '+job.token},body:f}));return {status:r.status,body:await r.json()};}
function packet(job){const item={...job.item,cond:'O2',quantityConfirmed:true};delete item.reviewToken;return {schemaVersion:1,queueId:job.id,reviewStatus:'awaiting_lee_approval',item,ebayTitle:core.ebayTitle(item),descriptionHtml:core.build(item),photoManifest:[{name:'qa.jpeg',width:1800,height:1700}],issues:[]};}
const submit=(j,ref)=>call(j,null,{listing:new Blob([JSON.stringify(packet(j))],{type:'application/json'}),photoReferences:JSON.stringify([ref])});
try{
 await system.db.exec(await fs.readFile(new URL('pending-commercial.sql',dir),'utf8'));
 await system.db.exec(await fs.readFile(new URL('current-review-constraint.sql',dir),'utf8'));
 for(const name of ['accept_ech_listing_review_v24','ech_draft_state_v24','save_ech_original_photo_v25','ech_pin_queue_v24'])await system.db.exec(await fs.readFile(new URL(name+'.sql',dir),'utf8'));
 const candidate=process.argv.includes('--candidate');
 if(candidate)for(const name of ['draft-revision.sql','require-originals.sql'])await system.db.exec(await fs.readFile(new URL('../../server/audit-proposals/'+name,import.meta.url),'utf8'));
 const shared=(await fs.readFile(new URL('ech-listing-review-v24/listing-core.ts',dir),'utf8')).replace(/^export .*$/gm,'');
 review=load(await fs.readFile(candidate?new URL('../../server/candidate/ech-listing-review/index.ts',import.meta.url):new URL('ech-listing-review-v24/index.ts',dir),'utf8'),shared);
 const a=await system.seed({sku:'QA-AUDIT-ORIGINALS'});
 const ref=(await call(a,'photo',{photo:jpeg()})).body.photo;
 const original=await call(a,'original',{photo:jpeg('full.jpeg'),normalizedSha256:ref.sha256});assert.equal(original.status,201);
 const originalPath=system.diskPath('ech-original-photos/'+original.body.original.storagePath), originalBytes=await fs.readFile(originalPath);
 const snapshot=(date,photos,text)=>JSON.stringify({_baseRevision:0,updatedAt:date,item:{...a.item,pdesc:text},photos});
 await call(a,'draft-save',{snapshot:snapshot('2026-11-02T12:00:00Z',[ref],'new correction')});
 await call(a,'draft-save',{snapshot:snapshot('2026-11-02T11:00:00Z',[],'old facts')});
 const stale=await call(a,'draft-read');
 const staleBlocked=stale.body.snapshot.item.pdesc==='new correction'&&stale.body.snapshot.photos.length===1;
 if(candidate)assert.ok(staleBlocked);
 record('Delayed older draft overwrites newer draft',staleBlocked?'VERIFIED':'FAILED','Newer correction and photo manifest must survive a delayed older save. Immutable original remains present.');
 assert.deepEqual(await fs.readFile(originalPath),originalBytes);
 // Move a fixture object aside; never remove an original or production object.
 const draftPath=system.diskPath(ref.storagePath);await fs.rename(draftPath,draftPath+'.held');
 const missing=await submit(a,ref);assert.equal(missing.status,422);assert.deepEqual(await fs.readFile(originalPath),originalBytes);
 await fs.rename(draftPath+'.held',draftPath);
 record('Missing review object rejects send and retains original','VERIFIED','422 before acceptance; original bytes identical; fixture object restored.');
 await fs.rename(originalPath,originalPath+'.held');
 const missingOriginal=await submit(a,ref);
 await fs.rename(originalPath+'.held',originalPath);
 if(candidate)assert.equal(missingOriginal.status,422);
 record('Original receipt exists but original object is missing',missingOriginal.status===422?'VERIFIED':'FAILED','Status '+missingOriginal.status+'; fixture original moved aside and restored without deleting bytes.');
 // Baseline may have consumed this permission on the missing-original case.
 const concurrent=await Promise.all([submit(a,ref),submit(a,ref)]);const retry=await submit(a,ref);
 const rows=(await system.db.query('select id from public.ech_listing_reviews where queue_id=$1',[a.id])).rows;
 assert.equal(rows.length,1);assert.equal(retry.body.reviewId,rows[0].id);assert.deepEqual(await fs.readFile(originalPath),originalBytes);
 record('Concurrent double submission and retry','VERIFIED',JSON.stringify({statuses:concurrent.map(x=>x.status),reviews:rows.length,retryStatus:retry.status,originalBytesIntact:true}));
 const b=await system.seed({sku:'QA-AUDIT-NO-ORIGINAL'}),bref=(await call(b,'photo',{photo:jpeg()})).body.photo;
 const noOriginal=await submit(b,bref);
 if(candidate)assert.notEqual(noOriginal.status,201);
 record('New fixture accepted without any original archive',noOriginal.status===201?'FAILED':'VERIFIED','Status '+noOriginal.status+'; backend applies a legacy warning without requiring private legacy eligibility.');
 const c=await system.seed({sku:'QA-AUDIT-PARTIAL'}),cref=(await call(c,'photo',{photo:jpeg()})).body.photo;
 system.failures.upload=true;const interrupted=await call(c,'original',{photo:jpeg('full.jpeg'),normalizedSha256:cref.sha256});
 assert.notEqual(interrupted.status,201);assert.deepEqual(await fs.readFile(system.diskPath(cref.storagePath)),Buffer.from(await jpeg().arrayBuffer()));
 const resumed=await call(c,'original',{photo:jpeg('full.jpeg'),normalizedSha256:cref.sha256});assert.equal(resumed.status,201);
 record('Interrupted original transfer and retry','VERIFIED','No false original receipt; normalized object retained; retry archives original.');
 const unauthorized=await call({token:'0'.repeat(64)},'draft-read');assert.equal(unauthorized.status,401);
 record('Unknown review permission','VERIFIED','401; no storage access or credential changes.');
 const pending=await system.seed({sku:'QA-AUDIT-PENDING-COMMERCIAL',price:null});
 await system.db.query("update private.ech_review_tokens set authorization_data=authorization_data||'{\"unitCost\":null,\"commercialPendingLee\":true}'::jsonb where queue_id=$1",[pending.id]);
 const pref=(await call(pending,'photo',{photo:jpeg()})).body.photo;
 assert.equal((await call(pending,'original',{photo:jpeg(),normalizedSha256:pref.sha256})).status,201);
 const intake=await submit(pending,pref);assert.equal(intake.status,201,JSON.stringify(intake));
 const prow=(await system.db.query('select unit_cost,target_price,review_status from public.ech_listing_reviews where queue_id=$1',[pending.id])).rows[0];
 assert.equal(prow.unit_cost,null);assert.equal(prow.target_price,null);assert.equal(prow.review_status,'awaiting_lee_approval');
 await assert.rejects(system.db.query("update public.ech_listing_reviews set review_status='ready_to_publish' where queue_id=$1",[pending.id]),/ech_review_pending_commercial_values/);
 record('Current live pending-commercial constraint','VERIFIED','Owned-stock physical intake accepts blank cost/price only with private hold; offer-ready transition still rejected.');
} finally {
 await system.close();await fs.mkdir(new URL('../runtime-evidence/',import.meta.url),{recursive:true});await fs.writeFile(new URL('../runtime-evidence/independent-'+(process.argv.includes('--candidate')?'candidate':'deployed')+'-audit.json',import.meta.url),JSON.stringify({mode:'deployed-source-and-live-RPC-snapshots/local-PostgreSQL/isolated-storage',results},null,2));
}
