(function(){
  'use strict';
  var APP_RELEASE=new URL(document.currentScript.src,location.href).searchParams.get('v')||'unversioned';
  var KEY='ech-prepared-items-v1';
  var TOKEN_KEY='ech-ready-queue-token-v1';
  var REVIEW_KEY='ech-review-ready-v1';
  var QUEUE_URL='https://qrhajotxduywvqmztvjq.supabase.co/rest/v1/rpc/';
  var QUEUE_KEY='sb_publishable_rVSKOjvP07R1RBdXFvLVww_yztwhmCZ';
  var $=function(id){return document.getElementById(id);};
  var items=[];
  var syncing=false;
  var queueVerified=false;
  var activeQueueId='';
  var switching=false;
  var activeLabel=document.createElement('p');activeLabel.id='activeProduct';activeLabel.setAttribute('role','status');
  activeLabel.style.cssText='position:sticky;top:0;z-index:20;background:#eef4f8;padding:14px;font-weight:700;border:2px solid #2f7a4f';
  $('preparedSelect').closest('section').after(activeLabel);
  var correctionNote=document.createElement('p');correctionNote.id='correctionInstructions';correctionNote.setAttribute('role','status');correctionNote.hidden=true;activeLabel.after(correctionNote);
  function showCorrection(it){correctionNote.textContent=it&&it.correctionNote?'Lee returned this item: '+it.correctionNote:'';correctionNote.hidden=!correctionNote.textContent;}

  function showActive(){var s=window.ECHStudio.getState();activeLabel.textContent=s.sku?'Working on: '+[s.brand,s.part].filter(Boolean).join(' '):'Choose a product above to begin.';}
  function lockWork(locked){document.querySelectorAll('.panel,.rail,#navNext,#navBack').forEach(function(el){el.inert=locked;});}
  document.addEventListener('ech:draftChanged',showActive);

  function authorization(it){ return window.ECHAuthorization?window.ECHAuthorization.check(it):{allowed:true,restricted:false,reason:''}; }
  function read(){ try{ items=JSON.parse(localStorage.getItem(KEY)||'[]'); }catch(e){ items=[]; } if(!Array.isArray(items)) items=[]; }
  function write(){ localStorage.setItem(KEY,JSON.stringify(items)); render(); }
  function status(s,bad){ $('queueStatus').textContent=s||''; $('queueStatus').style.color=bad?'#B03A3A':'#2F7A4F'; }
  function queueToken(){ try{return localStorage.getItem(TOKEN_KEY)||'';}catch(e){return '';} }
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
    var sel=$('preparedSelect'), oldSku=selected()&&selected().sku, currentSku=window.ECHStudio.getState().sku; sel.innerHTML='';
    var z=document.createElement('option'); z.value=''; z.textContent=items.length?'Choose your product…':'No approved products waiting'; sel.appendChild(z);
    var blocked=0;
    items.forEach(function(it,i){
      var auth=authorization(it); if(!auth.allowed)blocked++;
      var o=document.createElement('option'); o.value=String(i);
      o.textContent=(auth.allowed?'':'BLOCKED — ')+(it.queueLabel || [it.brand,it.part,it.what].filter(Boolean).join(' '));
      o.className=auth.allowed?'':'queue-blocked'; sel.appendChild(o);
    });
    var currentId=window.ECHStudio.getState()._draftId;
    var keep=items.findIndex(function(it){return currentId&&(it._queueId||it.queueId||it.productId)===currentId;});
    if(keep<0){var matching=items.map(function(it,i){return it.sku===(currentSku||oldSku)?i:-1;}).filter(function(i){return i>=0;});if(matching.length===1)keep=matching[0];}
    if(keep>=0)sel.value=String(keep);
    $('queueCount').textContent=(items.length-blocked)+' ready'+(blocked?' • '+blocked+' blocked':'');
    updateSelection();
  }
  function selected(){var value=$('preparedSelect').value;if(value==='')return null;return items[+value]||null;}
  function updateSelection(){ var it=selected(), allowed=it&&authorization(it).allowed; $('loadPrepared').disabled=!allowed; $('completePrepared').disabled=!it; }
  function mergeRemote(rows){
    if(!Array.isArray(rows)) throw new Error('Invalid queue response');
    var remoteIds=rows.map(function(row){return row.queueId;});
    // Remove retired cloud jobs from the selector, not the in-progress form/photos.
    items=items.filter(function(it){return !it._queueId || remoteIds.indexOf(it._queueId)>=0;});
    var added=0;
    (Array.isArray(rows)?rows:[]).forEach(function(row){
      var prepared=row&&row.payload&&Array.isArray(row.payload.items)?row.payload.items:[];
      prepared.forEach(function(it){
        if(!it||typeof it!=='object')return;
        var queueId=row.queueId||'', existing=items.findIndex(function(current){return queueId&&current._queueId===queueId;});
        var merged=Object.assign({},it,{_queueId:queueId,_recommendationId:row.recommendationId||'',_approvedAt:row.approvedAt||''});
        // Keep unavailable jobs visible so queue problems cannot look like missing work.
        if(existing>=0)items[existing]=merged; else {items.push(merged);added++;}
      });
    });
    write();
    return added;
  }
  function checkAppUpdate(){return fetch('release.json',{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('Update check unavailable');return r.json();}).then(function(meta){if(meta.release!==APP_RELEASE && /^[a-zA-Z0-9.-]+$/.test(meta.release||'')){var n=$('appUpdateNotice');if(!n){n=document.createElement('p');n.id='appUpdateNotice';$('queueStatus').after(n);}n.textContent='An app update is available. Finish and send your current item, then ';var a=document.createElement('a');a.textContent='open the updated app';a.target='_blank';a.rel='noopener';a.href=location.pathname+'?release='+encodeURIComponent(meta.release);n.appendChild(a);}}).catch(function(){});}
  checkAppUpdate();
  function syncApprovals(quiet){
    checkAppUpdate();
    var token=queueToken();
    var pinConnected=window.ECHPin&&window.ECHPin.connected();
    if(!token&&!pinConnected){ window.ECHPin.prompt(); if(!quiet)status('Enter your PIN above to connect this device.',true); return Promise.resolve(); }
    if(!navigator.onLine){ queueVerified=false; if(!quiet)status('Offline — saved work is available. Sync will retry when internet returns.'); return Promise.resolve(); }
    if(syncing)return Promise.resolve();
    syncing=true; $('syncApprovals').disabled=true;
    if(!quiet)status('Checking for approved work…');
    return (pinConnected?window.ECHPin.list():rpc('list_ech_ready_products',{p_token:token})).then(function(rows){
      var added=mergeRemote(rows);
      queueVerified=true;
      status(added?added+' newly approved product'+(added===1?' is':'s are')+' ready.':'Queue is current. '+items.length+' product'+(items.length===1?'':'s')+' ready.');
    }).catch(function(err){
      queueVerified=false;
      $('queueCount').textContent='Saved list — not verified';
      status(/credential rejected/i.test(err.message)?'Secure queue connection needs Lee to reconnect it.':'Could not refresh the list. Your current photos are still here. Tap Sync approved work before starting another item.',true);
    }).finally(function(){ syncing=false; $('syncApprovals').disabled=false; });
  }

  $('preparedSelect').addEventListener('change',function(){loadSelected();});
  async function preserveBeforeSwitch(retiredEmpty){
    var localError=null, cloudSaved=false;
    if(window.ECHStudio.waitForPhotos)await window.ECHStudio.waitForPhotos();
    // A failed device original/blob lookup must not prevent trying the
    // independent cloud backup. Never leave without a durable confirmation.
    if(window.ECHDrafts){try{await window.ECHDrafts.flush();}catch(e){localError=e;}}
    if(window.ECHCloud&&!retiredEmpty){
      await window.ECHCloud.ready();
      if(window.ECHCloud.isSubmitted&&window.ECHCloud.isSubmitted()){
        cloudSaved=true; // A durable review receipt already owns these photos.
      }else{
        var refs=await window.ECHCloud.flush();
        cloudSaved=Array.isArray(refs)&&refs.length===window.ECHStudio.photoCount();
        if(!cloudSaved)throw new Error('Cloud photo confirmation is incomplete. Keep this item open and retry saving photos.');
      }
    }
    if(localError&&!cloudSaved)throw new Error('Device photo storage could not save this item, and no current cloud backup was confirmed. '+(localError.message||''));
    return !!localError;
  }
  async function loadSelected(){
    if(switching)return;
    var it=selected();if(!it)return;var auth=authorization(it);if(!auth.allowed){status(auth.reason,true);return;}
    switching=true;lockWork(true);$('preparedSelect').disabled=true;$('loadPrepared').disabled=true;
    var openedNext=false;
    try{
      // A freshly reconciled queue is authoritative for retired jobs. Do not
      // require an obsolete job's upload permission just to open the next job.
      // Keep the old cloud draft intact, and never skip saving visible photos.
      var current=window.ECHStudio.getState();
      var retiredEmpty=queueVerified&&current.sku&&!items.some(function(x){return x.sku===current.sku;})&&!window.ECHStudio.photoCount();
      var savedInCloudOnly=await preserveBeforeSwitch(retiredEmpty);
      activeQueueId=it._queueId||'';document.dispatchEvent(new CustomEvent('ech:loadPrepared',{detail:it}));
      openedNext=true;showActive();showCorrection(it);
      if(window.ECHCloud)await window.ECHCloud.ready();
      showActive();showCorrection(it);status(savedInCloudOnly?'Product loaded. Previous work is saved in the cloud; this device could not save its local copy.':'Product loaded. Check the name above, then choose its condition.');
    }catch(e){
      var current=window.ECHStudio.getState().sku, index=items.findIndex(function(x){return x.sku===current;});
      if(index>=0)$('preparedSelect').value=String(index);
      status((openedNext?'Product opened, but saved-photo recovery needs a retry. Keep this item open; do not retake or clear its photos. ':'Could not switch safely. Your current photos are still here. ')+e.message,true);
    }finally{switching=false;lockWork(false);$('preparedSelect').disabled=false;updateSelection();}
  }
  window.ECHQueue={preserveCurrent:preserveBeforeSwitch};
  $('loadPrepared').addEventListener('click',loadSelected);
  $('syncApprovals').addEventListener('click',function(){syncApprovals(false);});
  $('importPrepared').addEventListener('click',function(){ $('preparedFile').click(); });
  $('preparedFile').addEventListener('change',function(e){
    var f=e.target.files[0]; if(!f)return; var rd=new FileReader();
    rd.onload=function(){
      try{
        var data=JSON.parse(rd.result), incoming=Array.isArray(data)?data:(data.items||[data]);
        if(!incoming.length)throw new Error('No items');
        var accepted=[],blocked=[]; incoming.forEach(function(it){(authorization(it).allowed?accepted:blocked).push(it);});
        items=items.concat(accepted); write();
        if(blocked.length)status('This product needs Lee\'s approval before you can work on it.',true);
        else{ $('preparedSelect').value=String(items.length-accepted.length); updateSelection(); loadSelected(); }
      }catch(err){ status('That is not an approved product file. Ask Lee for help.',true); }
    };
    rd.readAsText(f); e.target.value='';
  });
  $('completePrepared').addEventListener('click',function(){
    var n=+$('preparedSelect').value, it=items[n]; if(!it)return;
    if(!confirm('Remove '+(it.sku||it.part||'this product')+' from your list?'))return;
    items.splice(n,1); write(); status('Removed from your list.');
  });

  function fileSafe(value){ return String(value||'ECH-item').replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'ECH-item'; }
  function saveLocal(pack){
    var saved=[]; try{ saved=JSON.parse(localStorage.getItem(REVIEW_KEY)||'[]'); }catch(e){}
    if(!Array.isArray(saved))saved=[];
    saved=saved.filter(function(x){return !x||!x.item||x.item.sku!==pack.item.sku;});
    saved.push(pack);try{localStorage.setItem(REVIEW_KEY,JSON.stringify(saved));return true;}catch(e){return false;}
  }
  function handoffMessage(message,bad){ var el=$('handoffStatus'); el.textContent=message; el.className='handoff-status'+(bad?' handoff-error':' handoff-good'); }
  async function postToHub(endpoint,result){
    var form=new FormData();
    form.append('listing',new Blob([JSON.stringify(result.pack)],{type:'application/json'}),'listing-review.json');
    if(result.photoReferences)form.append('photoReferences',JSON.stringify(result.photoReferences));
    else result.files.forEach(function(file){form.append('photos',file,file.name);});
    return new Promise(function(resolve,reject){
      var xhr=new XMLHttpRequest();
      xhr.open('POST',endpoint,true);
      xhr.timeout=120000;
      xhr.setRequestHeader('Authorization','Bearer '+result.reviewToken);
      xhr.upload.onprogress=function(event){
        handoffMessage(event.lengthComputable
          ? 'Uploading photos: '+Math.round(event.loaded/event.total*100)+'%. Keep this page open.'
          : 'Uploading photos. Keep this page open.');
      };
      xhr.upload.onload=function(){handoffMessage('Photos transferred. Waiting for secure storage confirmation…');};
      xhr.onload=function(){
        var body; try{body=JSON.parse(xhr.responseText);}catch(e){body={};}
        if(xhr.status>=200&&xhr.status<300&&body.reviewId)resolve(body);
        else reject(new Error(body.error||'No storage confirmation received. Keep this page open and ask Lee to check receipt before retrying.'));
      };
      xhr.onerror=function(){reject(new Error('Connection interrupted. Keep this page open. Ask Lee to check receipt before retrying.'));};
      xhr.ontimeout=function(){reject(new Error('Upload timed out after 2 minutes. Keep this page open—your photos have not been cleared. Ask Lee to check receipt before retrying.'));};
      xhr.onabort=function(){reject(new Error('Upload stopped. Keep this page open; your photos have not been cleared.'));};
      xhr.send(form);
    });
  }
  async function shareReview(result){
    if(!navigator.share)return false;
    var sku=fileSafe(result.pack.item.sku||result.pack.item.part);
    var summary=new File([result.reviewText],sku+'-Lee-review.txt',{type:'text/plain'});
    var shareFiles=[summary].concat(result.files);
    if(navigator.canShare&&!navigator.canShare({files:shareFiles}))return false;
    await navigator.share({title:'ECH listing review — '+sku,text:'Ready for Lee to review. Nothing has been published to eBay.',files:shareFiles});
    return true;
  }
  function removeSubmitted(queueId){
    // Never retire sibling physical jobs merely because their model/SKU matches.
    items=items.filter(function(it){return !queueId||(it._queueId||it.queueId||it.productId)!==queueId;});
    write();
  }

  $('sendToLee').addEventListener('click',async function(){
    if(!window.ECHStudio||this.disabled)return;
    var button=this, old=button.textContent, confirmed=false;
    var submittingQueueId=window.ECHStudio.getState()._draftId;
    button.disabled=true;button.textContent='Checking…';lockWork(true);$('preparedSelect').disabled=true;$('resetWork').disabled=true;
    try{
      if(window.ECHStudio.waitForPhotos)await window.ECHStudio.waitForPhotos();
      if(window.ECHStudio.getState()._draftId!==submittingQueueId)throw new Error('The active product changed. Check the product name before sending.');
      var issues=window.ECHStudio.reviewIssues();if(issues.length)throw new Error(issues[0]);
      await preserveBeforeSwitch(false);
      var result=window.ECHStudio.prepareReview(), localReviewSaved=saveLocal(result.pack);
      var endpoint=String(window.ECH_REVIEW_ENDPOINT||'').trim();
      if(endpoint){
        if(!navigator.onLine)throw new Error('You are offline. The review is saved here; send it when the connection returns.');
        button.textContent='Sending…';
        if(window.ECHCloud){
          button.textContent='Saving photos…';
          result.photoReferences=await window.ECHCloud.flush();
          if(window.ECHCloud.archiveOriginals)await window.ECHCloud.archiveOriginals(result.photoReferences);
          button.textContent='Sending for review…';
        }
        var accepted=await postToHub(endpoint,result);
        confirmed=true;
        if(window.ECHCloud)window.ECHCloud.submitted();
        removeSubmitted(submittingQueueId);
        handoffMessage('Sent to Lee ✓ Review '+String(accepted.reviewId||'').slice(0,8)+' is waiting. Nothing was published to eBay.');
        status('Sent to Lee for approval.');
      }else{
        if(!localReviewSaved)throw new Error('Could not save the review on this device. Keep this item open and reconnect the Hub.');
        button.textContent='Opening…';
        var shared=await shareReview(result);
        if(shared){handoffMessage('Shared for Lee’s review ✓ Nothing was published to eBay.');status('Shared for Lee’s review.');}
        else{handoffMessage('Saved for Lee on this device. The automatic Business Hub connection needs Lee.');status('Saved for Lee on this device.');}
      }
    }catch(err){
      if(err&&err.name==='AbortError')handoffMessage('Sending was canceled. Nothing was published.',true);
      else handoffMessage(/constraint|relation|SQL|database/i.test((err&&err.message)||'')?'The review could not be saved. Your photos remain here. Ask Lee to check the receiving service before trying again.':((err&&err.message)||'Could not send this review. Your photos remain here. Nothing was published.'),true);
    }finally{lockWork(false);$('preparedSelect').disabled=false;$('resetWork').disabled=false;button.disabled=confirmed;button.textContent=confirmed?'Sent to Lee ✓':old;}
  });

  var connectedNow=acceptSetupLink();
  document.addEventListener('ech:pinConnected',function(){syncApprovals(false);});
  read(); render();showActive();
  if(connectedNow)status('Secure queue connected. Checking for approved work…');
  syncApprovals(!connectedNow);
  window.addEventListener('online',function(){syncApprovals(true);});
})();
