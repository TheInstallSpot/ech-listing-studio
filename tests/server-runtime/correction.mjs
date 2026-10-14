import {createSystem,origin,digest} from './system.mjs';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const system=await createSystem();
const core=createRequire(import.meta.url)('../../builder-core.js');
function jpeg(){return new File([new Uint8Array([255,216,255,192,0,11,8,6,164,7,8,1,1,17,0,255,217])],'fixture.jpeg',{type:'image/jpeg'});}
async function call(job,mode,extra={}){const form=new FormData();if(mode)form.append('mode',mode);for(const[k,v]of Object.entries(extra))form.append(k,v);const r=await system.review(new Request(origin+'/review'+(mode==='original'?'?mode=original':''),{method:'POST',headers:{origin,authorization:'Bearer '+job.token},body:form}));return {status:r.status,body:await r.json()};}
function packet(job){const item={...job.item,cond:'N1',quantityConfirmed:true};delete item.reviewToken;return {schemaVersion:1,queueId:job.id,reviewStatus:'awaiting_lee_approval',item,ebayTitle:core.ebayTitle(item),descriptionHtml:core.build(item),photoManifest:[{name:'fixture.jpeg',width:1800,height:1700}],issues:[]};}
async function submit(job,ref){return call(job,null,{listing:new Blob([JSON.stringify(packet(job))],{type:'application/json'}),photoReferences:JSON.stringify([ref])});}
try{
 await system.db.exec('create table if not exists private.ech_publish_approvers(actor_id text primary key,active boolean);insert into private.ech_publish_approvers values(\'owner\',true);');
 await system.db.exec(await fs.readFile(new URL('../../server/release/ECH_CORRECTION_LIFECYCLE.sql',import.meta.url),'utf8'));
 await system.db.exec((await fs.readFile(new URL('../../server/release/ECH_CORRECTION_RESEARCH_FUNCTIONS.sql',import.meta.url),'utf8')).replace(/DO \$guard\$[\s\S]*?END \$guard\$;/,''));
 await system.seedPin();const login=await system.pin(new Request(origin+'/pin',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({action:'login',pin:'123456'})}));const session=await login.json();
 const first=await system.seed();const uploaded=await call(first,'photo',{photo:jpeg()});assert.equal(uploaded.status,201);
 const original=await call(first,'original',{photo:jpeg(),normalizedSha256:uploaded.body.photo.sha256});assert.equal(original.status,201);
 const received=await submit(first,uploaded.body.photo);assert.equal(received.status,201);
 const review=(await system.db.query('select * from public.ech_listing_reviews where id=$1',[received.body.reviewId])).rows[0];
 await system.db.query("update public.ech_listing_reviews set listing=listing||$1::jsonb where id=$2",[JSON.stringify({agentPreparation:{version:'QA-PRIVATE-RESEARCH',proposedItemPrice:249.95,priceIsApproved:true,privateNote:'PRIVATE-RESEARCH'}}),review.id]);
 const id=randomUUID(),token=digest(randomUUID()),ref={...uploaded.body.photo,displayOrder:0,storagePath:`${first.sku}/drafts/${id}/${uploaded.body.photo.sha256}.jpeg`};
 const destination=system.diskPath(ref.storagePath);await fs.mkdir(new URL('.', 'file://'+destination).pathname,{recursive:true});await fs.copyFile(system.diskPath(uploaded.body.photo.storagePath),destination);
 const result=(await system.db.query('select public.decide_ech_review_v25($1,$2,$3,$4,$5,$6,$7,$8) r',[review.id,review.updated_at,'owner','return_to_paige','Measure packed buyer-unit weight and dimensions; keep the saved photos.',id,token,[ref]])).rows[0].r;
 assert.equal(result.status,'returned_to_paige');
 const queue=await system.rpc('ech_pin_queue_v24',{p_token:session.token,p_logout:false});const correction=queue.items.find(row=>row.queueId===id);assert.ok(correction);assert.equal(correction.payload.items[0].correctionNote,'Measure packed buyer-unit weight and dimensions; keep the saved photos.');
 for(const key of ['unitCost','cost','targetPrice','researchNotes','shippingPlan'])assert.equal(key in correction.payload.items[0],false);
 const next={id,sku:first.sku,token,item:correction.payload.items[0]};
 const recovered=await call(next,'draft-read');assert.equal(recovered.status,200);assert.equal(recovered.body.snapshot.photos.length,1);assert.equal(recovered.body.snapshot.item.quantityConfirmed,false);assert.equal(recovered.body.snapshot.item.cond,'');assert.equal(recovered.body.originals[0].id,original.body.original.id);assert.equal(recovered.body.originals[0].sha256,original.body.original.sha256);
 Object.assign(next.item,{packedWeightLb:'2.5',packedLengthIn:'12',packedWidthIn:'9',packedHeightIn:'4'});
 const submitted=await submit(next,ref);assert.equal(submitted.status,201,JSON.stringify(submitted.body));assert.notEqual(submitted.body.reviewId,review.id);
 const retry=await submit(next,ref);assert.equal(retry.body.reviewId,submitted.body.reviewId);
 const all=(await system.db.query('select id,review_status from public.ech_listing_reviews')).rows;assert.equal(all.length,2);assert.equal(all.find(r=>r.id===review.id).review_status,'returned_to_paige');assert.equal(all.find(r=>r.id===submitted.body.reviewId).review_status,'awaiting_lee_approval');
 const measurementRow=(await system.db.query('select listing from public.ech_listing_reviews where id=$1',[submitted.body.reviewId])).rows[0];
 for(const [key,value] of Object.entries({packedWeightLb:'2.5',packedLengthIn:'12',packedWidthIn:'9',packedHeightIn:'4'}))assert.equal(measurementRow.listing.item[key],value);
 assert.equal(measurementRow.listing.agentPreparation.version,'QA-PRIVATE-RESEARCH');assert.equal(measurementRow.listing.agentPreparation.priceIsApproved,false);assert.equal(measurementRow.listing.agentPreparation.sourceReviewId,review.id);assert.equal(measurementRow.listing.commercialApproval,undefined);assert.equal(JSON.stringify(recovered.body).includes('PRIVATE-RESEARCH'),false);assert.equal(JSON.stringify(correction).includes('PRIVATE-RESEARCH'),false);
 const nextVersion=(await system.db.query('select updated_at from public.ech_listing_reviews where id=$1',[submitted.body.reviewId])).rows[0].updated_at;
 const thirdId=randomUUID(),thirdToken=digest(randomUUID()),thirdRef={...ref,storagePath:`${first.sku}/drafts/${thirdId}/${ref.sha256}.jpeg`};
 await system.db.query('select public.decide_ech_review_v25($1,$2,$3,$4,$5,$6,$7,$8)',[submitted.body.reviewId,nextVersion,'owner','return_to_paige','Confirm existing packed measurements.',thirdId,thirdToken,[thirdRef]]);
 const thirdSnapshot=(await system.db.query('select snapshot from private.ech_photo_drafts where queue_id=$1',[thirdId])).rows[0].snapshot;
 for(const [key,value] of Object.entries({packedWeightLb:'2.5',packedLengthIn:'12',packedWidthIn:'9',packedHeightIn:'4'}))assert.equal(thirdSnapshot.item[key],value);
 assert.equal(JSON.stringify(thirdSnapshot).includes('PRIVATE-RESEARCH'),false);
 const grants=(await system.db.query("select has_function_privilege('anon','public.inspect_ech_correction_source_v27(text)','execute') a,has_function_privilege('authenticated','public.inspect_ech_correction_source_v27(text)','execute') u,has_function_privilege('service_role','public.inspect_ech_correction_source_v27(text)','execute') s")).rows[0];assert.equal(grants.a,false);assert.equal(grants.u,false);assert.equal(grants.s,true);
 const oldPhotos=(await system.db.query('select count(*)::int n from public.ech_listing_review_photos where review_id=$1',[review.id])).rows[0];assert.equal(oldPhotos.n,1);
 assert.equal((await fs.readFile(system.diskPath(uploaded.body.photo.storagePath))).length,uploaded.body.photo.sizeBytes);
 const old=await call(first,'draft-read');assert.equal(old.body.reviewId,review.id);
 console.log('PASS: actual receiving functions, PIN queue and PostgreSQL return/recover/resubmit/retry lifecycle; original receipt/photo bytes retained; packed measurements added without another photo upload; no eBay calls.');
}finally{await system.close();}
