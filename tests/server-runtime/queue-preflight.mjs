import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {createSystem,origin} from './system.mjs';
const s=await createSystem();
try{
 await s.db.exec("create or replace function private.ech_owned_nov16_intake_v32(text,text,text,text) returns boolean language sql immutable as $$select false$$;");
 await s.db.exec(await fs.readFile(new URL('../../server/queue-preparation-guard.sql',import.meta.url),'utf8'));
 await s.seedPin();const a=await s.seed({sku:'QA-UNIT-A'}),b=await s.seed({sku:'QA-UNIT-B'});
 const login=await s.pin(new Request(origin+'/pin',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({action:'login',pin:'123456'})}));const session=await login.json();
 await s.db.query("update private.ech_review_tokens set authorization_data=authorization_data||'{\"saleUnit\":\"set\"}'::jsonb where queue_id=$1",[b.id]);
 const result=await s.rpc('ech_pin_queue_v24',{p_token:session.token,p_logout:false});
 const good=result.items.find(x=>x.queueId===a.id).payload.items[0],bad=result.items.find(x=>x.queueId===b.id).payload.items[0];
 assert.equal(good._preparationError,undefined);assert.equal(bad._preparationError,'sale-unit approval mismatch');
 for(const key of ['unitCost','cost','targetPrice','researchNotes','shippingPlan'])assert.equal(key in bad,false);
 assert.equal((await s.db.query('select count(*)::int n from public.ech_ready_products')).rows[0].n,2);
 console.log('PASS actual SQL queue marks inconsistent private sale-unit setup before capture; hides commercial data; keeps both physical jobs and photos untouched');
}finally{await s.close();}
