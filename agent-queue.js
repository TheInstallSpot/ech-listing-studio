(function(){
  'use strict';
  var KEY='ech-prepared-items-v1';
  var $=function(id){return document.getElementById(id);};
  var items=[];
  function authorization(it){ return window.ECHAuthorization?window.ECHAuthorization.check(it):{allowed:true,restricted:false,reason:''}; }

  function read(){ try{ items=JSON.parse(localStorage.getItem(KEY)||'[]'); }catch(e){ items=[]; } if(!Array.isArray(items)) items=[]; }
  function write(){ localStorage.setItem(KEY,JSON.stringify(items)); render(); }
  function status(s,bad){ $('queueStatus').textContent=s||''; $('queueStatus').style.color=bad?'#B03A3A':'#2F7A4F'; }
  function render(){
    var sel=$('preparedSelect'), old=sel.value; sel.innerHTML='';
    if(!items.length){ var z=document.createElement('option'); z.value=''; z.textContent='No prepared items yet'; sel.appendChild(z); }
    var blocked=0;
    items.forEach(function(it,i){ var auth=authorization(it); if(!auth.allowed)blocked++; var o=document.createElement('option'); o.value=String(i); o.textContent=(auth.allowed?'':'BLOCKED — ')+(it.sku?it.sku+' — ':'')+[it.brand,it.part,it.what].filter(Boolean).join(' '); o.className=auth.allowed?'':'queue-blocked'; sel.appendChild(o); });
    if(old&&items[+old]) sel.value=old;
    $('queueCount').textContent=(items.length-blocked)+' ready'+(blocked?' • '+blocked+' blocked':'');
    updateSelection();
  }
  function selected(){ var n=+$('preparedSelect').value; return items[n]||null; }
  function updateSelection(){ var it=selected(), allowed=it&&authorization(it).allowed; $('loadPrepared').disabled=!allowed; $('completePrepared').disabled=!it; }

  $('preparedSelect').addEventListener('change',function(){ var it=selected(), auth=it?authorization(it):null; updateSelection(); status(auth&&!auth.allowed?auth.reason:'',auth&&!auth.allowed); });
  function loadSelected(){ var it=selected(); if(!it)return; var auth=authorization(it); if(!auth.allowed){status(auth.reason,true);return;} document.dispatchEvent(new CustomEvent('ech:loadPrepared',{detail:it})); status('Your product is ready. Start by choosing the condition.'); }
  $('loadPrepared').addEventListener('click',loadSelected);
  $('importPrepared').addEventListener('click',function(){ $('preparedFile').click(); });
  $('preparedFile').addEventListener('change',function(e){
    var f=e.target.files[0]; if(!f)return; var rd=new FileReader();
    rd.onload=function(){ try{ var data=JSON.parse(rd.result); var incoming=Array.isArray(data)?data:(data.items||[data]); if(!incoming.length)throw new Error('No items'); var accepted=[],blocked=[]; incoming.forEach(function(it){(authorization(it).allowed?accepted:blocked).push(it);}); items=items.concat(accepted); write(); if(blocked.length){status('This product needs Lee\'s approval before you can work on it.',true);}else{ $('preparedSelect').value=String(items.length-accepted.length); updateSelection(); loadSelected(); } }catch(err){ status('That is not an approved product file. Ask Lee for help.',true); } };
    rd.readAsText(f); e.target.value='';
  });
  $('completePrepared').addEventListener('click',function(){ var n=+$('preparedSelect').value, it=items[n]; if(!it)return; if(!confirm('Are you finished with '+(it.sku||it.part||'this product')+'?'))return; items.splice(n,1); write(); status('Great job! This product is finished.'); });
  $('exportPackage').addEventListener('click',function(){
    if(!window.ECHStudio)return; var s=window.ECHStudio.getState(); var pack={schemaVersion:1,exportedAt:new Date().toISOString(),item:s,ebayTitle:window.ECHStudio.buildTitle(),descriptionHtml:window.ECHStudio.buildHtml(),missing:window.ECHStudio.problems()};
    var blob=new Blob([JSON.stringify(pack,null,2)],{type:'application/json'}), a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=(s.sku||s.part||'ech-item')+'-listing-package.json'; a.click(); setTimeout(function(){URL.revokeObjectURL(a.href);},1000); status('Exported the current listing package.');
  });
  read(); render();
})();
