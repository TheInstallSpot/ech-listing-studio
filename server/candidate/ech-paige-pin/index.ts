// No PINs, session tokens, or request bodies are logged.
const allowedOrigin = Deno.env.get('ECH_STUDIO_ORIGIN') || 'https://theinstallspot.github.io';
Deno.serve(async (req: Request) => {
  const headers = {'Access-Control-Allow-Origin':allowedOrigin,
    'Access-Control-Allow-Headers':'authorization, apikey, content-type',
    'Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store',
    'Content-Type':'application/json','Vary':'Origin'};
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body),{status,headers});
  if (req.headers.get('origin') && req.headers.get('origin') !== allowedOrigin) return reply({error:'forbidden'},403);
  if(req.method === 'OPTIONS') return new Response(null,{status:204,headers});
  if(req.method !== 'POST') return reply({error:'method'},405);
  try {
    if(Number(req.headers.get('content-length') || 0)>2048) return reply({error:'too_large'},413);
    // Limit streamed input too; Content-Length is not trusted.
    const reader=req.body?.getReader(); let raw=''; let length=0;
    if(!reader) return reply({error:'bad_request'},400);
    const decoder=new TextDecoder();
    while(true){ const {value,done}=await reader.read(); if(done)break;
      length+=value.length; if(length>2048){await reader.cancel();return reply({error:'too_large'},413);}
      raw+=decoder.decode(value,{stream:true}); }
    raw+=decoder.decode();
    const body=JSON.parse(raw);
    if(!['login','queue','logout'].includes(body.action)) return reply({error:'bad_request'},400);
    const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const url=Deno.env.get('SUPABASE_URL');
    if(!key||!url)return reply({error:'unavailable'},503);
    const isLogin=body.action==='login';
    const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
    const args=isLogin?{p_pin:typeof body.pin==='string'?body.pin.slice(0,64):null}
      :{p_token:token,p_logout:body.action==='logout'};
    const response=await fetch(url+'/rest/v1/rpc/'+(isLogin?'ech_pin_login':'ech_pin_queue_v24'),{
      method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},
      body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});
    if(!response.ok)return reply({error:'unavailable'},503);
    const result=await response.json();
    return reply(result,result.error?(result.error==='locked'?429:result.error==='not_ready'?503:401):200);
  } catch {return reply({error:'unavailable'},503);}
});

