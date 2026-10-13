import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {createSystem,origin} from './system.mjs';
const core=createRequire(import.meta.url)('../../builder-core.js');
const system=await createSystem();
const jobs=[['INT26-C4-SR260','Control4','SR-260'],['INT26-AVPRO-AC-MXNET-SW10','AVPro Edge','AC-MXNET-SW10'],['INT26-NETGEAR-GS348PP','NETGEAR','GS348PP'],['INT26-EPISODE-ESS-SUB-SNGL-8','Episode','ESS-SUB-SNGL-8'],['INT26-KEF-T301C','KEF','T301C'],['INT26-KEF-CI200QL-GRILLE-WH','KEF','Ci200QL grille'],['INT26-KEF-RIF200R','KEF','RIF200R'],['INT26-KEF-Q6-META-GRILLE','KEF','Q6 Meta grille'],['INT26-KEF-CI200QR-GRILLE-WH','KEF','Ci200QR grille']];
async function call(job,fields){const form=new FormData();for(const[k,v]of Object.entries(fields))form.append(k,v);const res=await system.review(new Request('http://isolated.local/review',{method:'POST',headers:{origin,authorization:'Bearer '+job.token},body:form}));return {status:res.status,body:await res.json()};}
try{
 const browser={window:{}};vm.runInNewContext(await fs.readFile(new URL('../../authorization-registry.js',import.meta.url),'utf8'),browser);
 for(const[sku,brand,part]of jobs)assert.equal(browser.window.ECHAuthorization.check({sku,brand,part,fulfillment:'ech'}).allowed,true);
 for(const[sku,brand,part,fulfillment]of [['INT26-KEF-T301C','KEF','WRONG','ech'],['INT26-KEF-T301C','KEF','T301C','distributor'],['KEF-OTHER','KEF','T301C','ech'],['INT26-KEF-T301C','Focal','T301C','ech']]){
  assert.equal(browser.window.ECHAuthorization.check({sku,brand,part,fulfillment}).allowed,false);
  const held=await system.seed({sku,brand,part});await system.db.query("UPDATE private.ech_review_tokens SET authorization_data=jsonb_set(authorization_data,'{fulfillment}',to_jsonb($1::text)) WHERE queue_id=$2",[fulfillment,held.id]);
  const denied=await call(held,{mode:'photo',photo:new File(['invalid'],'fixture.jpeg',{type:'image/jpeg'})});assert.notEqual(denied.status,201);
  const allowed=await system.db.query('SELECT public.ech_review_allowed_v24($1) AS allowed',[held.authorization.reviewToken||await (async()=>{const r=await system.db.query('SELECT token_hash FROM private.ech_review_tokens WHERE queue_id=$1',[held.id]);return r.rows[0].token_hash;})()]);assert.equal(allowed.rows[0].allowed,false);
 }
 console.log('PASS Browser and actual PostgreSQL retain wrong-model, distributor and other-brand holds');
 await system.db.exec("ALTER TABLE public.ech_listing_reviews ADD CONSTRAINT ech_review_pending_commercial_values CHECK (unit_cost IS NOT NULL AND target_price IS NOT NULL)");
 await system.db.exec(await fs.readFile(new URL('../../server/release/ECH_OWNER_INTAKE_PENDING_COMMERCIAL.sql',import.meta.url),'utf8'));
 await system.seedPin();const login=await system.pin(new Request('http://isolated.local/pin',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({action:'login',pin:'123456'})}));assert.equal(login.status,200);const session=await login.json();
 for(const[sku,brand,part]of jobs){
  const job=await system.seed({sku,brand,part,price:null,expiry:'-1 hour'});
  await system.db.query("UPDATE private.ech_review_tokens SET authorization_data=authorization_data||'{\"unitCost\":null}'::jsonb WHERE queue_id=$1",[job.id]);
  const queue=await system.rpc('ech_pin_queue_v24',{p_token:session.token,p_logout:false});assert.ok(queue.items.some(i=>i.queueId===job.id));assert.ok(queue.items.every(i=>i.payload.items.every(p=>!('unitCost' in p)&&!('targetPrice' in p))));
  const photo=new File([new Uint8Array([255,216,255,192,0,17,8,6,164,7,8,3,1,17,0,2,17,0,3,17,0,255,217])],'fixture.jpeg',{type:'image/jpeg'});
  const upload=await call(job,{mode:'photo',photo});assert.equal(upload.status,201,sku+' photo');
  const item={...job.item,cond:'O2',quantityConfirmed:true};delete item.reviewToken;
  const saved=await call(job,{mode:'draft-save',snapshot:JSON.stringify({item,photos:[upload.body.photo]})});assert.equal(saved.status,200);const recovered=await call(job,{mode:'draft-read'});assert.equal(recovered.body.snapshot.photos.length,1);assert.equal(recovered.body.snapshot.item.sku,sku);
  const listing={schemaVersion:1,queueId:job.id,reviewStatus:'awaiting_lee_approval',item,ebayTitle:core.ebayTitle(item),descriptionHtml:core.build(item),photoManifest:[{name:'fixture.jpeg',width:1800,height:1700}],issues:[]};
  const sent=await call(job,{listing:new Blob([JSON.stringify(listing)],{type:'application/json'}),photoReferences:JSON.stringify([upload.body.photo])});
  assert.equal(sent.status,201,sku+' submission '+JSON.stringify(sent.body));
  const replay=await call(job,{listing:new Blob([JSON.stringify(listing)],{type:'application/json'}),photoReferences:JSON.stringify([upload.body.photo])});assert.equal(replay.body.reviewId,sent.body.reviewId);
  const after=await system.rpc('ech_pin_queue_v24',{p_token:session.token,p_logout:false});assert.ok(!after.items.some(i=>i.queueId===job.id));
  const row=(await system.db.query('SELECT review_status,unit_cost,target_price,photo_count FROM public.ech_listing_reviews WHERE queue_id=$1',[job.id])).rows[0];
  assert.equal(row.review_status,'awaiting_lee_approval');assert.equal(row.unit_cost,null);assert.equal(row.target_price,null);assert.equal(row.photo_count,1);
  await assert.rejects(system.db.query("UPDATE public.ech_listing_reviews SET review_status='ready_to_publish' WHERE queue_id=$1",[job.id]),/ech_review_pending_commercial_values/);
  console.log('PASS '+sku+' real receiver/photo/review with pending pricing; publication stage blocked');
 }
}finally{await system.close();}
