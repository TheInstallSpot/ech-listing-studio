(function(){
  'use strict';
  var KEY='ech-prepared-items-v1';
  var TOKEN_KEY='ech-ready-queue-token-v1';
  var PENDING_KEY='ech-ready-queue-pending-v1';
  var QUEUE_URL='https://qrhajotxduywvqmztvjq.supabase.co/rest/v1/rpc/';
  var QUEUE_KEY='sb_publishable_rVSKOjvP07R1RBdXFvLVww_yztwhmCZ';
  var $=function(id){return document.getElementById(id);};
  var items=[];
  var syncing=false;

  function authorization(it){ return window.ECHAuthorization?window.ECHAuthorization.check(it):{allowed:true,restricted:false,reason:''}; }
  function read(){ try{ items=JSON.parse(localStorage.getItem(KEY)||'[]'); }catch(e){ items=[]; } if(!Array.isArray(items)) items=[]; }
  function write(){ localStorage.setItem(KEY,JSON.stringify(items)); render(); }
  function status(s,bad){ $('queueStatus').textContent=s||''; $('queueStatus').style.color=bad?'#B03A3A':'#2F7A4F'; }
  function queueToken(){ try{return localStorage.getItem(TOKEN_KEY)||'';}catch(e){return '';} }
  function pending(){ try{var p=JSON.parse(localStorage.getItem(PENDING_KEY)||'[]');return Array.isArray(p)?p:[];}catch(e){return [];} }
  function savePending(p){ try{localStorage.setItem(PENDING_KEY,JSON.stringify(p));}catch(e){} }
  function rpc(name,body){
    return fetch(QUEUE_URL+name,{
      method:'POST',
      headers:{'apikey':QUEUE_KEY,'Authorization':'Bearer '+QUEUE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify(body)
    }).then(function(res){
      if(!res.ok)return res.json().catch(function(){return {};}).then(function(data){throw new Error(data.message||'Queue request failed');});
      return res.json();
    });
  }
  function acceptSetupLink(){
    var raw=location.hash&&location.hash.slice(1), params=new URLSearchParams(raw||''), token=params.get('queue');
    if(!token)return false;
    try{localStorage.setItem(TOKEN_KEY,token);}catch(e){}
    history.replaceState(null,'',location.pathname+location.search);
    return true;
  }
  function render(){
    var sel=$('preparedSelect'), old=sel.value; sel.innerHTML='';
    if(!items.length){ var z=document.createElement('option'); z.value=''; z.textContent='No approved products waiting'; sel.appendChild(z); }
    var blocked=0;
    items.forEach(function(it,i){ var auth=authorization(it); if(!auth.allowed)blocked++; var o=document.createElement('option'); o.value=String(i); o.textContent=(auth.allowed?'':'BLOCKED — ')+(it.sku?it.sku+' — ':'')+[it.brand,it.part,it.what].filter(Boolean).join(' '); o.className=auth.allowed?'':'queue-blocked'; sel.appendChild(o); });
    if(old&&items[+old]) sel.value=old;
    $('queueCount').textContent=(items.length-blocked)+' ready'+(blocked?' • '+blocked+' blocked':'');
    updateSelection();
  }
  function selected(){ var n=+$('preparedSelect').value; return items[n]||null; }
  function updateSelection(){ var it=selected(), allowed=it&&authorization(it).allowed; $('loadPrepared').disabled=!allowed; $('completePrepared').disabled=!it; }
  function mergeRemote(rows){
    var added=0;
    (Array.isArray(rows)?rows:[]).forEach(function(row){
      var prepared=row&&row.payload&&Array.isArray(row.payload.items)?row.payload.items:[];
      prepared.forEach(function(it){
        if(!it||typeof it!=='object')return;
        var queueId=row.queueId||'', exists=items.some(function(current){return queueId&&current._queueId===queueId;});
        if(exists)return;
        var merged=Object.assign({},it,{_queueId:queueId,_recommendationId:row.recommendationId||'',_approvedAt:row.approvedAt||''});
        if(authorization(merged).allowed){items.push(merged);added++;}
      });
    });
    if(added)write();else render();
    return added;
  }
  function flushPending(token){
    var rows=pending();
    if(!rows.length)return Promise.resolve(0);
    var remaining=[];
    return rows.reduce(function(chain,row){
      return chain.then(function(){
        return rpc('complete_ech_ready_product',{p_token:token,p_id:row.id,p_output:row.output||null})
          .catch(function(){remaining.push(row);});
      });
    },Promise.resolve()).then(function(){savePending(remaining);return rows.length-remaining.length;});
  }
  function syncApprovals(quiet){
    var token=queueToken();
    if(!token){ if(!quiet)status('This iPad needs Lee’s one-time secure setup link.',true); return Promise.resolve(); }
    if(!navigator.onLine){ if(!quiet)status('Offline — saved work is available. Sync will retry when internet returns.'); return Promise.resolve(); }
    if(syncing)return Promise.resolve();
    syncing=true;
    $('syncApprovals').disabled=true;
    if(!quiet)status('Checking for approved work…');
    return flushPending(token).then(function(){
      return rpc('list_ech_ready_products',{p_token:token});
    }).then(function(rows){
      var added=mergeRemote(rows);
      status(added?added+' newly approved product'+(added===1?' is':'s are')+' ready.':'Queue is current. '+items.length+' product'+(items.length===1?'':'s')+' ready.');
    }).catch(function(err){
      status(/credential rejected/i.test(err.message)?'Secure queue connection needs Lee to reconnect it.':'Could not sync right now. Saved work still works offline.',true);
    }).finally(function(){
      syncing=false;
      $('syncApprovals').disabled=false;
    });
  }

  $('preparedSelect').addEventListener('change',function(){ var it=selected(), auth=it?authorization(it):null; updateSelection(); status(auth&&!auth.allowed?auth.reason:'',auth&&!auth.allowed); });
  function loadSelected(){ var it=selected(); if(!it)return; var auth=authorization(it); if(!auth.allowed){status(auth.reason,true);return;} document.dispatchEvent(new CustomEvent('ech:loadPrepared',{detail:it})); status('Your product is ready. Start by choosing the condition.'); }
  $('loadPrepared').addEventListener('click',loadSelected);
  $('syncApprovals').addEventListener('click',function(){syncApprovals(false);});
  $('importPrepared').addEventListener('click',function(){ $('preparedFile').click(); });
  $('preparedFile').addEventListener('change',function(e){
    var f=e.target.files[0]; if(!f)return; var rd=new FileReader();
    rd.onload=function(){ try{ var data=JSON.parse(rd.result); var incoming=Array.isArray(data)?data:(data.items||[data]); if(!incoming.length)throw new Error('No items'); var accepted=[],blocked=[]; incoming.forEach(function(it){(authorization(it).allowed?accepted:blocked).push(it);}); items=items.concat(accepted); write(); if(blocked.length){status('This product needs Lee\'s approval before you can work on it.',true);}else{ $('preparedSelect').value=String(items.length-accepted.length); updateSelection(); loadSelected(); } }catch(err){ status('That is not an approved product file. Ask Lee for help.',true); } };
    rd.readAsText(f); e.target.value='';
  });
  $('completePrepared').addEventListener('click',function(){
    var n=+$('preparedSelect').value, it=items[n]; if(!it)return;
    if(!confirm('Are you finished with '+(it.sku||it.part||'this product')+'?'))return;
    var output=null;
    if(window.ECHStudio){var s=window.ECHStudio.getState();output={schemaVersion:1,completedAt:new Date().toISOString(),item:s,ebayTitle:window.ECHStudio.buildTitle(),descriptionHtml:window.ECHStudio.buildHtml(),missing:window.ECHStudio.problems()};}
    if(it._queueId){
      var rows=pending();rows.push({id:it._queueId,output:output});savePending(rows);
    }
    items.splice(n,1);write();status('Great job! This product is finished and will sync to Lee.');
    syncApprovals(true);
  });
  $('exportPackage').addEventListener('click',function(){
    if(!window.ECHStudio)return; var s=window.ECHStudio.getState(); var pack={schemaVersion:1,exportedAt:new Date().toISOString(),item:s,ebayTitle:window.ECHStudio.buildTitle(),descriptionHtml:window.ECHStudio.buildHtml(),missing:window.ECHStudio.problems()};
    var blob=new Blob([JSON.stringify(pack,null,2)],{type:'application/json'}), a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=(s.sku||s.part||'ech-item')+'-listing-package.json'; a.click(); setTimeout(function(){URL.revokeObjectURL(a.href);},1000); status('Exported the current listing package.');
  });
  var connectedNow=acceptSetupLink();
  read();render();
  if(connectedNow)status('Secure queue connected. Checking for approved work…');
  syncApprovals(!connectedNow);
  window.addEventListener('online',function(){syncApprovals(true);});
})();
