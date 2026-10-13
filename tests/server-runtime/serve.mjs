import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createSystem,root,origin} from './system.mjs';
const directory=path.join(root,'tests/server-runtime/.runtime',new URL(origin).port);
let system=await createSystem({directory});await system.seedPin();
if(!(await system.db.query('select count(*)::int as n from public.ech_ready_products')).rows[0].n){
 await system.seed({sku:'LOCAL-E2E-SPEAKER'});await system.seed({sku:'LOCAL-E2E-SPEAKER'});await system.seed({brand:'KEF',sku:'KEF-LOCAL-HELD'});
}
const evidence=path.join(root,'tests/runtime-evidence');await fs.mkdir(evidence,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
const htmlEscape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,origin);res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'");
 async function body(){const chunks=[];let n=0;for await(const c of req){n+=c.length;if(n>26*1024*1024)throw Error('Local test input too large');chunks.push(c);}return Buffer.concat(chunks);}
 function json(data,status=200){res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data));}
 if(u.pathname==='/review'||u.pathname==='/pin'){
  const headers=new Headers(req.headers);const bytes=await body();const request=new Request(origin+u.pathname+u.search,{method:req.method,headers,body:req.method==='OPTIONS'?undefined:bytes});
  const response=await system[u.pathname==='/review'?'review':'pin'](request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
 }
 if(u.pathname.startsWith('/storage/v1/')){
  const response=await system.bridge('https://isolated-ech.invalid'+u.pathname,{method:req.method});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
 }
 if(u.pathname==='/__test/control'&&req.method==='POST'){
  if(req.headers.origin!==origin)return json({error:'Origin forbidden'},403);
  const action=JSON.parse((await body()).toString());
  if(action.shutdown){json({stopped:true});server.close();await system.close();return;}
  if(action.restart){await system.close();system=await createSystem({directory});return json({restarted:true});}
  for(const k of Object.keys(system.failures))if(action[k])system.failures[k]=true;
  return json({configured:true});
 }
 if(u.pathname==='/__test/receipts'){
  const {rows}=await system.db.query('select id,queue_id,review_status,photo_count,listing,listing_id,published_at from public.ech_listing_reviews order by received_at');
  const originals=rows.length?await system.rpc('read_ech_original_photos_v25',{p_queue_ids:rows.map(r=>r.queue_id)}):[];
  for(const original of originals){const bytes=await fs.readFile(system.diskPath('ech-original-photos/'+original.storagePath));original.actualSha256=createHash('sha256').update(bytes).digest('hex');}
  return json({originals,reviews:rows.map(r=>({...r,listing:{item:{sku:r.listing.item.sku,productId:r.listing.item.productId,pdesc:r.listing.item.pdesc,serialRecorded:!!r.listing.item.serialNumber},descriptionHtml:r.listing.descriptionHtml}}))});
 }
 if(u.pathname==='/__test/evidence'&&req.method==='POST'){
  if(req.headers.origin!==origin)return json({error:'Origin forbidden'},403);
  const data=JSON.parse((await body()).toString());await fs.writeFile(path.join(evidence,'real-server-browser-'+String(data.phase).replace(/[^a-z0-9-]/gi,'')+'.json'),JSON.stringify(data,null,2));return json({saved:true});
 }
 if(u.pathname==='/lee-review'){
  const {rows}=await system.db.query('select id,sku,review_status,photo_count,listing,listing_id from public.ech_listing_reviews order by received_at');
  res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><title>Local Lee review receipts</title><h1>Isolated review receipts</h1><p>Local test database. Nothing is published to eBay.</p>'+rows.map(r=>'<article><h2>'+htmlEscape(r.sku)+'</h2><p>Receipt '+htmlEscape(r.id)+' — '+htmlEscape(r.review_status)+' — '+r.photo_count+' stored photo(s)</p>'+r.listing.descriptionHtml+'</article>').join(''));return;
 }
 if(u.pathname==='/review-config.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end('window.ECH_REVIEW_ENDPOINT="'+origin+'/review";window.ECH_PIN_ENDPOINT="'+origin+'/pin";');return;}
 let relative=u.pathname==='/'?'index.html':u.pathname.slice(1);const target=path.resolve(root,relative);
 if(!target.startsWith(root+path.sep)||relative.startsWith('server/')||relative.includes('node_modules')||relative.includes('.runtime')||relative.startsWith('.'))return json({error:'Path forbidden'},403);
 let bytes=await fs.readFile(target);
 if(relative==='app.js')bytes=Buffer.from(bytes.toString().replace("if('serviceWorker' in navigator){","if(false){"));
 if(relative==='index.html')bytes=Buffer.from(bytes.toString().replace(/(src="[^"]+\.js)\?[^"]*/g,'$1?integration=1').replace('</body>','<section style="padding:20px;background:#fff7df"><h2>Isolated actual-server integration</h2><p>Synthetic local inventory and PostgreSQL. Test PIN: 123456. No production connections.</p><button id="runServerFlow">Run full server workflow</button><pre id="serverFlowResult">Ready</pre><a href="/lee-review">Open local Lee review receipts</a></section><script src="tests/run-server-browser.js"></script></body>'));
 res.writeHead(200,{'content-type':types[path.extname(target)]||'application/octet-stream'});res.end(bytes);
}catch(e){res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({error:e.message}));}});
server.listen(Number(new URL(origin).port),'127.0.0.1',()=>console.log('Isolated actual-server app '+origin));
async function shutdown(){server.close();await system.close();process.exit(0);}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
