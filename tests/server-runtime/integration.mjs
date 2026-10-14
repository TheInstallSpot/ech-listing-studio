import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createSystem,origin} from './system.mjs';
const require=createRequire(import.meta.url),core=require('../../builder-core.js');
const results=[];function ok(test,condition){assert.ok(condition,test);results.push({test,status:'PASS'});console.log('PASS '+test);}
const system=await createSystem({baseline:process.argv.includes('--baseline')});
const requestOrigin=process.argv.includes('--baseline')?'https://theinstallspot.github.io':origin;
function jpeg(){return new File([new Uint8Array([255,216,255,192,0,17,8,6,164,7,8,3,1,17,0,2,17,0,3,17,0,255,217])],'fixture.jpeg',{type:'image/jpeg'});}
async function call(job,mode,extra={}){const f=new FormData();if(mode)f.append('mode',mode);for(const[k,v]of Object.entries(extra))f.append(k,v);const r=await system.review(new Request('http://isolated.local/review',{method:'POST',headers:{origin:requestOrigin,authorization:'Bearer '+job.token},body:f}));return {status:r.status,body:await r.json()};}
function packet(job,changes={}){const item={...job.item,cond:'N1',quantityConfirmed:true,serialNumber:'PRIVATE-SERIAL',packaging:'open_box',defects:'Remote missing',...changes};delete item.reviewToken;return {schemaVersion:1,queueId:job.id,reviewStatus:'awaiting_lee_approval',item,ebayTitle:core.ebayTitle(item),descriptionHtml:core.build(item),photoManifest:[{name:'fixture.jpeg',width:1800,height:1700}],issues:[]};}
async function submit(job,ref,changes={},override={}){return call(job,null,{listing:new Blob([JSON.stringify({...packet(job,changes),...override})],{type:'application/json'}),photoReferences:JSON.stringify([ref])});}
try{
 await system.seedPin();const login=await system.pin(new Request('http://isolated.local/pin',{method:'POST',headers:{origin:requestOrigin,'content-type':'application/json'},body:JSON.stringify({action:'login',pin:'123456'})}));const session=await login.json();ok('Actual PIN receiver and PostgreSQL login authenticate synthetic operator',login.status===200&&session.token.length===64);
 const a=await system.seed(),b=await system.seed({sku:a.sku});
 const queueRpc=process.argv.includes('--baseline')?'ech_pin_queue':'ech_pin_queue_v24';
 const q=await system.rpc(queueRpc,{p_token:session.token,p_logout:false});ok('Authenticated queue strips private cost and target price',q.items.every(r=>r.payload.items.every(i=>!('unitCost'in i)&&!('targetPrice'in i))));
 const upload=await call(a,'photo',{photo:jpeg()});ok('Actual receiver validates JPEG and stores acknowledged bytes',upload.status===201&&upload.body.photo.width===1800);
 const ref=upload.body.photo;
 const wrong=await submit(b,ref);ok('Another physical job cannot attach the same-SKU photo',wrong.status===422);
 const empty=await call(a,'draft-read');ok('New job reads an empty draft successfully',empty.status===200);
 const draft=await call(a,'draft-save',{snapshot:JSON.stringify({item:{...a.item,cond:'N1',quantityConfirmed:true,pdesc:'Operator correction',packedWeightLb:'2.5',packedLengthIn:'12',packedWidthIn:'9',packedHeightIn:'4'},photos:[ref]})});ok('Actual SQL persists corrected draft',draft.status===200);
 const recovered=await call(a,'draft-read');ok('Draft read returns corrected facts and private signed photo',recovered.status===200&&recovered.body.snapshot.item.pdesc==='Operator correction'&&recovered.body.snapshot.photos[0].signedUrl);
 ok('SQL strips review token from stored draft',!recovered.body.snapshot.item.reviewToken);
 ok('Measured packed dimensions survive actual receiver and SQL draft recovery',recovered.body.snapshot.item.packedWeightLb==='2.5'&&recovered.body.snapshot.item.packedLengthIn==='12'&&recovered.body.snapshot.item.packedWidthIn==='9'&&recovered.body.snapshot.item.packedHeightIn==='4');
 for (const bad of ['-1','0','NaN','Infinity']) { const invalidMeasurement=await submit(a,ref,{packedWeightLb:bad});ok('Invalid packed weight '+bad+' fails before review acceptance',invalidMeasurement.status===422); }
 const tampered=await submit(a,ref,{availableQuantity:'9'});ok('Changed quantity fails exact Lee-approval comparison',tampered.status===422);
 const price=await submit(a,ref,{targetPrice:'1.00'});ok('Changed price fails exact Lee-approval comparison',price.status===422);
 const malformed=await call(a,'photo',{photo:new File(['not JPEG'],'fake.jpeg',{type:'image/jpeg'})});ok('False JPEG filename is rejected',malformed.status===422);
 system.failures.upload=true;const failed=await call(b,'photo',{photo:jpeg()});ok('Storage failure never returns a saved-photo acknowledgment',failed.status===503&&!failed.body.photo);
 const unconfirmed=await submit(a,ref,{quantityConfirmed:false});ok('Human quantity/contents confirmation enforced on server',unconfirmed.status===422);
 for(const [brand,sku,part]of[['KEF','KEF-QA-HELD','QA-HELD'],['Focal','FOCAL-QA-HELD','QA-HELD'],['Definitive Technology','DEFINITIVE-TECHNOLOGY-HELD','QA-HELD'],['Sony','SONY-ES','XS-ES'],['Sonance','SONANCE-MAG','MAG6R'],['AudioQuest','AQ-NOT-APPROVED','OTHER']]){
  const held=await system.seed({brand,sku,part});const hold=await call(held,'photo',{photo:jpeg()});ok(brand+' hold denied before any photo storage',hold.status!==201);
 }
 const expired=await system.seed({expiry:'-1 hour'});const denied=await call(expired,'photo',{photo:jpeg()});ok('Expired item permission blocks upload',denied.status===401);
 const renewed=await system.rpc(queueRpc,{p_token:session.token,p_logout:false});ok('Authorized session renews exact expired unused job without replacing token',renewed.items.some(i=>i.queueId===expired.id));
 system.failures.draft=true;const draftFailure=await call(b,'draft-save',{snapshot:JSON.stringify({item:b.item,photos:[]})});ok('SQL persistence failure does not claim draft saved',draftFailure.status===503);
 system.failures.afterCommit=true;
 const accepted=await submit(a,ref,{targetPrice:'',reviewToken:'INJECTED-TOKEN',unknownSecret:'INJECTED-SECRET'},{descriptionHtml:'<p>PRIVATE-SERIAL<script>bad()</script></p>'});ok('Lost database response resolves through durable receipt',accepted.status===200&&accepted.body.reviewId);
 const rows=await system.db.query('select listing,photo_count from public.ech_listing_reviews where queue_id=$1',[a.id]);ok('Exactly one review contains complete photo count',rows.rows.length===1&&rows.rows[0].photo_count===1);
 ok('Server rebuilds public HTML without serial or injected script',!rows.rows[0].listing.descriptionHtml.includes('PRIVATE-SERIAL')&&!rows.rows[0].listing.descriptionHtml.includes('<script>'));
 ok('Private serial remains available only in review item',rows.rows[0].listing.item.serialNumber==='PRIVATE-SERIAL');
 ok('Server allowlist excludes injected credentials and unknown fields',!rows.rows[0].listing.item.reviewToken&&!rows.rows[0].listing.item.unknownSecret);
 const replay=await submit(a,ref);ok('Retry returns the same receipt without duplicate review',replay.body.reviewId===accepted.body.reviewId);
 const count=await system.db.query('select count(*)::int as n from public.ech_listing_reviews');ok('Replay preserves one durable database review',count.rows[0].n===1);
 const queueAfter=await system.rpc(queueRpc,{p_token:session.token,p_logout:false});ok('Completed job leaves queue while same-SKU sibling remains',!queueAfter.items.some(i=>i.queueId===a.id)&&queueAfter.items.some(i=>i.queueId===b.id));
 const legacy=await system.seed({sku:'QA-LEGACY-V23'});const legacyPacket=packet(legacy);delete legacyPacket.queueId;delete legacyPacket.item.quantityConfirmed;
 const f=new FormData();f.append('listing',new Blob([JSON.stringify(legacyPacket)],{type:'application/json'}),'legacy.json');f.append('photos',jpeg());
 const oldResponse=await system.legacyReview(new Request('http://isolated.local/legacy',{method:'POST',headers:{origin:'https://theinstallspot.github.io',authorization:'Bearer '+legacy.token},body:f}));
 ok('Additive server upgrade preserves unmodified v23 receiver and packet',oldResponse.status===201);
 const categoryJob=await system.seed({sku:'QA-LEGACY-MISSING-CATEGORY'});const categoryPhoto=await call(categoryJob,'photo',{photo:jpeg()});const categoryResult=await submit(categoryJob,categoryPhoto.body.photo,{ebayCategoryId:''});ok('Legacy device missing category inherits exact trusted job category without losing inspection or photos',categoryResult.status===201);
 const pendingCategory=await system.seed({sku:'QA-CATEGORY-PENDING-OWNER'});await system.db.query("update private.ech_review_tokens set authorization_data=authorization_data || $1::jsonb where queue_id=$2",[JSON.stringify({ebayCategoryId:'',categoryPendingLee:true}),pendingCategory.id]);const pendingPhoto=await call(pendingCategory,'photo',{photo:jpeg()});const pendingResult=await submit(pendingCategory,pendingPhoto.body.photo,{ebayCategoryId:''});ok('Explicit private legacy category hold allows physical review only',pendingResult.status===201);const pendingRow=(await system.db.query('select warnings,listing from public.ech_listing_reviews where queue_id=$1',[pendingCategory.id])).rows[0];ok('Missing category remains blank and management warning persists',pendingRow.listing.item.ebayCategoryId===''&&pendingRow.warnings.some(w=>w.includes('publication remain blocked')));
 const incomplete=await system.seed({sku:'QA-INCOMPLETE'});const incompletePhoto=await call(incomplete,'photo',{photo:jpeg()});const incompleteResult=await submit(incomplete,incompletePhoto.body.photo,{spec:[]});
 ok('Incomplete specs can reach Lee review without invented facts',incompleteResult.status===201);
 const warning=await system.db.query('select warnings from public.ech_listing_reviews where queue_id=$1',[incomplete.id]);ok('Server-computed incomplete-spec warning persists for Lee review',warning.rows[0].warnings.some(w=>w.includes('Technical specifications are incomplete'))&&warning.rows[0].warnings.some(w=>w.includes('Full originals are unavailable')));
 const priv=await system.db.query("select has_function_privilege('service_role','public.accept_ech_listing_review_v24(text,uuid,jsonb,jsonb)','execute') as service, exists(select 1 from pg_proc p,aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.proname='accept_ech_listing_review_v24' and a.grantee=0 and a.privilege_type='EXECUTE') as public");
 ok('New receiving SQL is executable by service role and not PUBLIC',priv.rows[0].service&&!priv.rows[0].public);
}finally{await system.close();await fs.mkdir(new URL('../runtime-evidence/',import.meta.url),{recursive:true});await fs.writeFile(new URL('../runtime-evidence/server-integration.json',import.meta.url),JSON.stringify({mode:'actual-receiver/local-PostgreSQL/isolated-storage',results},null,2));}
console.log(results.length+' actual-server integration checks passed.');
