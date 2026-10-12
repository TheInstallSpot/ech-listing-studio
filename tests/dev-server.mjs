import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname),port=8891,photos=new Map(),drafts=new Map(),receipts=new Map();
let count=0,failNext=false;
const output=path.join(root,'tests/runtime-evidence');await mkdir(output,{recursive:true});
const type={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.png':'image/png','.css':'text/css','.json':'application/json'};
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1:'+port);
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; font-src 'self'");
 if(url.pathname==='/mock-review'){
  const buffers=[];for await(const b of req)buffers.push(b);const data=await new Request(url,{method:'POST',headers:req.headers,body:Buffer.concat(buffers)}).formData();
  const token=req.headers.authorization||'';if(!/^Bearer fixture-/.test(token)){res.writeHead(403);res.end('{}');return;}
  const mode=data.get('mode');let result={};if(receipts.has(token)){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(receipts.get(token)));return;}
  if(mode==='fail-next'){failNext=true;result={ok:true};}
  else if(failNext&&mode==='photo'){failNext=false;res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({error:'Simulated upload failure'}));return;}
  else if(mode==='photo'){const file=data.get('photo'),bytes=Buffer.from(await file.arrayBuffer());const sha=createHash('sha256').update(bytes).digest('hex');photos.set(sha,bytes);result={photo:{id:sha,sha256:sha,originalName:file.name,signedUrl:'/fixture-photo/'+sha}};}
  else if(mode==='draft-save'){drafts.set(token,JSON.parse(data.get('snapshot')));result={saved:true};}
  else if(mode==='draft-read'){result={snapshot:drafts.get(token)||null};const d=result.snapshot;if(d)d.photos=d.photos.map(p=>({...p,signedUrl:'/fixture-photo/'+p.sha256}));}
  else {const file=data.get('listing');const listing=file?JSON.parse(await file.text()):null;result={reviewId:'fixture-review-'+(++count),status:'awaiting_lee_approval'};receipts.set(token,result);await writeFile(path.join(output,'mock-review-'+count+'.json'),JSON.stringify({listing,result},null,2));}
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(result));return;
 }
 if(url.pathname.startsWith('/fixture-photo/')){res.writeHead(200,{'content-type':'image/jpeg'});res.end(photos.get(url.pathname.split('/').pop())||Buffer.alloc(0));return;}
 if(url.pathname==='/evidence'&&req.method==='POST'){let b='';for await(const c of req)b+=c;await writeFile(path.join(output,'browser-results.json'),b);res.end('saved');return;}
 if(url.pathname==='/review-config.js'){res.setHeader('content-type','text/javascript');res.end('window.ECH_REVIEW_ENDPOINT="http://127.0.0.1:8891/mock-review";');return;}
 let relative=url.pathname==='/'?'index.html':url.pathname.slice(1);const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 let body=await readFile(file);
 if(relative==='app.js'&&url.searchParams.has('acceptanceSource'))body=Buffer.from(body.toString().replace("if('serviceWorker' in navigator){","if(false){"));
 if(relative==='index.html'&&url.searchParams.has('acceptance'))body=Buffer.from(body.toString().replace(/(src="[^"]+\.js)\?[^"]*/g,'$1?acceptanceSource='+Date.now()).replace('</body>','<section style="background:#fff7df;padding:20px"><h2>LOCAL SYNTHETIC ACCEPTANCE</h2><button id="runAcceptance">Run acceptance suite</button><pre id="acceptanceResult" style="white-space:pre-wrap">No test run yet.</pre></section><script src="tests/run-browser.js?acceptanceSource=' + Date.now() + '"></script></body>'));
 res.writeHead(200,{'content-type':type[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(body);
 }catch(e){res.writeHead(500);res.end(String(e.message));}});
server.listen(port,'127.0.0.1',()=>console.log('Local synthetic acceptance server http://127.0.0.1:'+port+'/?acceptance=1'));
