import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto,createHash,randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';

export const root=path.resolve(new URL('../..',import.meta.url).pathname);
export const digest=s=>createHash('sha256').update(s).digest('hex');
export const origin='http://127.0.0.1:'+(process.env.ECH_LOCAL_PORT||8892);
const primary={ech_ready_products:'id',ech_listing_reviews:'id',ech_listing_review_photos:'id',ech_listing_audit_log:'id',ech_review_tokens:'queue_id',ech_photo_drafts:'queue_id',ech_pin_account:'id',ech_pin_sessions:'token_hash'};
const rpcs=new Set(['inspect_ech_review_token','ech_review_receipt','ech_draft_state','accept_ech_listing_review','ech_pin_login','ech_pin_queue','inspect_ech_review_token_v24','ech_draft_state_v24','accept_ech_listing_review_v24','ech_pin_queue_v24']);
export async function createSystem({directory,baseline=false}={}){
 const data=directory||await fs.mkdtemp('/private/tmp/ech-real-server-');
 await fs.mkdir(data,{recursive:true});
 const db=new PGlite(path.join(data,'pgdata'),{extensions:{pgcrypto}});await db.waitReady;
 await db.exec("create schema if not exists private; create schema if not exists auth; create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions;");
 await db.exec("do $$ begin if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end $$;");
 await db.exec("create or replace function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$; set request.jwt.claim.role='service_role';");
 const columns=JSON.parse(await fs.readFile(path.join(root,'server/baseline/columns.json'),'utf8'));
 const tables=new Map();for(const c of columns){const key=c.table_schema+'.'+c.table_name;if(!tables.has(key))tables.set(key,[]);tables.get(key).push(c);}
 for(const [table,cols]of tables){const fields=cols.map(c=>`"${c.column_name}" ${c.udt_name==='timestamptz'?'timestamp with time zone':c.udt_name}${c.column_default?' default '+c.column_default:''}${c.is_nullable==='NO'?' not null':''}`);fields.push(`primary key (${primary[cols[0].table_name]})`);await db.exec(`create table if not exists ${table} (${fields.join(',')})`);}
 // These unique identities are the production receipt and photo-order invariants.
 await db.exec('create unique index if not exists review_queue_unique on public.ech_listing_reviews(queue_id); create unique index if not exists review_photo_order on public.ech_listing_review_photos(review_id,display_order);');
 for(const family of baseline?['baseline']:['baseline','candidate']){
  const sqlDir=path.join(root,'server',family,'sql');
  if(family==='candidate')await db.exec(await fs.readFile(path.join(root,'server/release/ADDITIVE_RECEIVER_SQL.sql'),'utf8'));
  else for(const f of (await fs.readdir(sqlDir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await fs.readFile(path.join(sqlDir,f),'utf8'));
 }
 const failures={upload:false,draft:false,afterCommit:false,sign:false};let lastReview=null;
 async function rpc(name,args){if(!rpcs.has(name))throw Error('Unsupported isolated RPC');const keys=Object.keys(args);const {rows}=await db.query(`select public.${name}(${keys.map((k,i)=>`${k} => $${i+1}`).join(',')}) as result`,keys.map(k=>args[k]));return rows[0].result;}
 function diskPath(key){const target=path.resolve(data,'photos',key);if(!target.startsWith(path.resolve(data,'photos')+path.sep))throw Error('Invalid storage path');return target;}
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
 async function bridge(url,opts={}){
  const u=new URL(url);if(!['https://isolated-ech.invalid',origin].includes(u.origin))throw Error('External network is disabled in isolated receiver');
  if(u.pathname.startsWith('/rest/v1/rpc/')){
   const name=u.pathname.split('/').pop();
   if(failures.draft&&name.startsWith('ech_draft_state')){failures.draft=false;return reply({message:'Fixture draft persistence unavailable'},503);}
   try{const result=await rpc(name,JSON.parse(opts.body));if(name.startsWith('accept_ech_listing_review')){lastReview=result;if(failures.afterCommit){failures.afterCommit=false;return reply({message:'Fixture lost commit response'},503);}}return reply(result);}
   catch(e){return reply({message:e.message},400);}
  }
  const prefix='/storage/v1/object/';if(!u.pathname.startsWith(prefix))throw Error('Unsupported isolated transport');
  const rest=u.pathname.slice(prefix.length);const mode=rest.startsWith('sign/')?'sign':rest.startsWith('authenticated/')?'get':'object';
  const withBucket=mode==='object'?rest:rest.slice(mode==='sign'?5:14);const key=decodeURIComponent(withBucket.replace(/^ech-review-photos\//,''));
  if(mode==='sign'){if(failures.sign){failures.sign=false;return reply({},503);}await fs.access(diskPath(key));return reply({signedURL:'/object/authenticated/ech-review-photos/'+key});}
  if(mode==='get'){try{return new Response(await fs.readFile(diskPath(key)),{headers:{'content-type':'image/jpeg'}});}catch{return reply({},404);}}
  if(opts.method==='DELETE'){for(const k of JSON.parse(opts.body).prefixes)await fs.unlink(diskPath(k)).catch(()=>{});return reply({});}
  if(failures.upload){failures.upload=false;return reply({},503);}
  const bytes=opts.body instanceof ArrayBuffer?Buffer.from(opts.body):Buffer.from(await opts.body.arrayBuffer());const file=diskPath(key);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);return reply({Key:key},200);
 }
 function load(source,extra=''){
  let handler;const ctx={Request,Response,Headers,FormData,File,Blob,URL,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortSignal,setTimeout,clearTimeout,crypto:webcrypto,fetch:bridge,console:{info(){}},Deno:{env:{get:n=>({SUPABASE_URL:origin,SUPABASE_SERVICE_ROLE_KEY:'synthetic-server-key',ECH_STUDIO_ORIGIN:origin})[n]},serve:fn=>handler=fn}};
  vm.createContext(ctx);const js=stripTypeScriptTypes(extra+'\n'+source.replace(/^import[^\n]+\n/gm,''),{mode:'strip'});new vm.Script(js).runInContext(ctx);return handler;
 }
 const family=baseline?'baseline':'candidate';const shared=baseline?'':(await fs.readFile(path.join(root,'server/shared/listing-core.ts'),'utf8')).replace(/^export .*$/gm,'');
 const review=load(await fs.readFile(path.join(root,`server/${family}/ech-listing-review/index.ts`),'utf8'),shared);
 const pin=load(await fs.readFile(path.join(root,`server/${family}/ech-paige-pin/index.ts`),'utf8'));
 async function seed({id=randomUUID(),sku='QA-SPEAKER',brand='Fixture',part='QA-100',token=digest(randomUUID()),expiry='7 days',price='199.99'}={}){
  const item={_queueId:id,productId:sku,sku,brand,part,what:'Passive Speaker',sold:'Each',title:'Fixture QA-100 Passive Speaker',pdesc:'Synthetic local equipment.',box:['One speaker','One grille'],spec:[['Impedance','8 ohms']],ver:['Fixture label checked'],availableQuantity:'2',fulfillment:'ech',isPassive:true,reviewToken:token,ebayCategoryId:'14990',targetPrice:price};
  const authorization={...item,saleUnit:'each',saleUnitLabel:'Each',unitCost:'100.00'};delete authorization.reviewToken;
  await db.query('insert into public.ech_ready_products(id,recommendation_id,sku,payload,status,approved_at) values($1,$2,$3,$4,\'ready\',now())',[id,'synthetic-'+id,sku,{items:[item]}]);
  await db.query("insert into private.ech_review_tokens(queue_id,recommendation_id,sku,token_hash,authorization_data,expires_at) values($1,$2,$3,$4,$5,now()+$6::interval)",[id,'synthetic-'+id,sku,digest(token),authorization,expiry]);return {id,sku,token,item,authorization};
 }
 async function seedPin(value='123456'){await db.query("insert into private.ech_pin_account(id,pin_hash,enabled) values(true,extensions.crypt($1,extensions.gen_salt('bf')),true) on conflict(id) do nothing",[value]);}
 const legacyReview=baseline?review:load(await fs.readFile(path.join(root,'server/baseline/ech-listing-review/index.ts'),'utf8'));
 return {db,data,review,legacyReview,pin,rpc,seed,seedPin,failures,bridge,diskPath,get lastReview(){return lastReview;},close:()=>db.close()};
}
