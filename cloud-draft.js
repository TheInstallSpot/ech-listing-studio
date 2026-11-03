(function(){
  'use strict';
  var timer, busy=null, recovering=false, recoveryFailed=false, stopped=false, cache={}, originalCache={}, revision=0;
  var recoveryTask=null,recoveryGeneration=0,originalAutoConsent='',recoveredDraft=null,serverRevision=0,pendingSave=null;
  var status=document.createElement('div');
  status.id='cloudSaveStatus';status.setAttribute('role','status');
  status.style.cssText='padding:12px;margin:10px 0;background:#eef4f8;border-radius:8px';
  document.getElementById('photoSummary').after(status);
  var retry=document.createElement('button');retry.type='button';retry.textContent='Retry saving photos';retry.hidden=true;
  status.after(retry);
  function say(message,error){status.textContent=message;retry.hidden=!error;}
  function photoGate(locked){['takePhoto','choosePhoto','clearPhotos'].forEach(function(id){var el=document.getElementById(id);if(el)el.disabled=locked;});}
  async function request(mode,token,extra){
    var form=new FormData();form.append('mode',mode);
    Object.keys(extra||{}).forEach(function(k){form.append(k,extra[k]);});
    var controller=new AbortController(), timeout=setTimeout(function(){controller.abort();},mode==='original'?120000:45000);
    try{
      var response=await fetch(window.ECH_REVIEW_ENDPOINT+(mode==='original'?'?mode=original':''),{method:'POST',body:form,headers:{Authorization:'Bearer '+token},signal:controller.signal});
      var body=await response.json();
      if(!response.ok){var error=new Error(body.error||'Could not confirm cloud storage.');error.code=body.code;throw error;}
      // A signed, server-confirmed receipt is a terminal success, not a failed
      // recovery. Only reads may consume it; uploads must never treat it as a photo.
      if(body.reviewId&&mode!=='draft-read')throw new Error('This item has already been sent to Lee.');
      return body;
    }finally{clearTimeout(timeout);}
  }
  async function hash(file){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(function(n){return n.toString(16).padStart(2,'0');}).join('');}
  function photoKey(item,sha){
    // Permissions belong to a physical job, not every item sharing its SKU.
    // The token stays solely in this in-memory key, never in a saved snapshot.
    return JSON.stringify([item._draftId||item.productId||'',item.reviewToken,sha]);
  }
  async function saveSnapshot(token,snapshot){
    // Reuse the exact mutation after a lost reply. Reading a matching saved
    // mutation confirms success without asking Paige to repeat or reconcile it.
    async function confirm(pending){
      var lastError;
      for(var attempt=0;attempt<2;attempt++){
        try{
          var result=await request('draft-save',pending.token,{snapshot:JSON.stringify(pending.snapshot)});
          if(result.snapshot&&Number.isInteger(result.snapshot._revision))serverRevision=result.snapshot._revision;
          return;
        }catch(error){
          lastError=error;
          if(error.code==='draft_revision_conflict')throw error;
          try{
            var observed=await request('draft-read',pending.token,{}),saved=observed.snapshot;
            if(saved&&saved._mutationId===pending.snapshot._mutationId){serverRevision=saved._revision;return;}
          }catch(readError){/* Retry the same mutation; never invent a receipt. */}
        }
      }
      throw lastError;
    }
    if(pendingSave){
      if(pendingSave.token!==token)throw new Error('Previous photo saving is not confirmed. Keep that product open.');
      await confirm(pendingSave);pendingSave=null;
    }
    snapshot._baseRevision=serverRevision;
    snapshot._mutationId=crypto.randomUUID();
    pendingSave={token:token,snapshot:snapshot};
    await confirm(pendingSave);pendingSave=null;
  }
  async function saveNow(){
    if(recovering||recoveryFailed)throw new Error('Please wait for cloud recovery or tap Retry saving photos.');
    if(busy){await busy;return saveNow();}
    var studio=window.ECHStudio;
    if(studio.waitForPhotos)await studio.waitForPhotos();
    var item=studio.getState(), token=item.reviewToken, version=revision, savedAt=new Date().toISOString();
    if(stopped)return [];
    if(!token||!item.sku){if(studio.photoCount())throw new Error('Photos need a connected product before they can be saved.');return [];}
    var files=studio.exportPhotos();
    busy=(async function(){
      var keys=await Promise.all(files.map(async function(file){return photoKey(item,await hash(file));}));
      var refs=keys.map(function(key){return cache[key];});
      for(var i=0;i<files.length;i++){
        var key=keys[i];
        say('Saving photo '+(i+1)+' of '+files.length+' to the cloud…');
        if(!cache[key])cache[key]=(await request('photo',token,{photo:files[i]})).photo;
        refs[i]=cache[key];
        // Each confirmed photo is attached immediately, even if a later upload fails.
        var clean=Object.assign({},item);delete clean.reviewToken;
        await saveSnapshot(token,{updatedAt:savedAt,item:clean,photos:refs.flatMap(function(ref,index){return ref?[Object.assign({},ref,{originalName:files[index].name})]:[];})});
      }
      if(!files.length){var clean=Object.assign({},item);delete clean.reviewToken;await saveSnapshot(token,{updatedAt:savedAt,item:clean,photos:[]});}
      if(version===revision)say(files.length+' photos saved securely in the cloud ✓');
      if(version===revision&&originalAutoConsent===item._draftId)await archiveOriginals(refs);
      return refs;
    })();
    try{return await busy;}catch(error){say(error.code==='draft_revision_conflict'?error.message:'Not all photos are saved yet. Keep this page open and tap Retry saving photos.',true);throw error;}
    finally{busy=null;}
  }
  async function archiveOriginals(refs){
    // Runs on a new user-added photo or explicit Send to Lee, never on page load.
    var snapshot=window.ECHStudio.snapshotDraft(),item=window.ECHStudio.getState(),cleanFiles=window.ECHStudio.exportPhotos(),saved=0;
    for(var i=0;i<snapshot.photos.length;i++){
      var photo=snapshot.photos[i];
      if(photo.originalAvailable===false)continue; // A normalized legacy recovery is not a full original.
      var ref=refs[i],originalSha;
      if(!ref||!cleanFiles[i]||await hash(cleanFiles[i])!==ref.sha256)throw new Error('Photos changed while saving. Wait for storage confirmation or retry.');
      try{originalSha=await hash(photo.original);}
      catch(error){
        // A stale device File is not evidence that its archived original is
        // missing. Read and checksum the full server-linked original first.
        var archived=await request('draft-read',item.reviewToken,{});
        var linked=(archived.originals||[]).find(function(o){return o.normalizedSha256===ref.sha256;});
        if(!linked||!linked.signedUrl)throw new Error('This device cannot read the original photo, and its full cloud original is not confirmed. Keep this page open; the displayed photo has not been cleared.');
        var controller=new AbortController(),timeout=setTimeout(function(){controller.abort();},45000);
        try{
          var response=await fetch(linked.signedUrl,{signal:controller.signal});
          if(!response.ok)throw new Error('The archived original could not be opened. Keep this page open.');
          var recovered=await response.blob();
          if(recovered.size!==linked.sizeBytes||await hash(recovered)!==linked.sha256)throw new Error('Archived original verification failed. Keep this page open.');
          originalCache[photoKey(item,linked.sha256)+'|'+ref.sha256]=linked;
          saved++;continue;
        }finally{clearTimeout(timeout);}
      }
      var key=photoKey(item,originalSha)+'|'+ref.sha256;
      if(!originalCache[key]){
        say('Archiving original photo '+(i+1)+' of '+snapshot.photos.length+' securely…');
        var result=await request('original',item.reviewToken,{photo:photo.original,normalizedSha256:ref.sha256});
        if(!result.original||result.original.sha256!==originalSha||result.original.sizeBytes!==photo.original.size)throw new Error('Original storage could not be verified. Keep this page open.');
        originalCache[key]=result.original;
      }
      saved++;
    }
    say(saved+' full original'+(saved===1?'':'s')+' archived securely. Clean listing photos stay separate.');
    return saved;
  }
  function schedule(){revision++;clearTimeout(timer);if(!recovering&&!stopped)timer=setTimeout(function(){saveNow().catch(function(){});},1200);}
  async function recover(){
    var generation=++recoveryGeneration;
    clearTimeout(timer);recovering=true;recoveryFailed=false;stopped=false;recoveredDraft=null;serverRevision=0;photoGate(true);
    var studio=window.ECHStudio,item=studio.getState(),token=item.reviewToken;
    if(!token){recovering=false;photoGate(false);say('Choose a product to save its photos securely.');return;}
    say('Checking for saved cloud photos…');
    try{
      var result=await request('draft-read',token,{}), draft=result.snapshot;
      if(generation!==recoveryGeneration)return;
      serverRevision=draft&&Number.isInteger(draft._revision)?draft._revision:0;
      if(result.reviewId){
        stopped=true;
        var send=document.getElementById('sendToLee');
        if(send){send.disabled=true;send.textContent='Sent to Lee ✓';}
        if(studio.showReceipt)studio.showReceipt();
        say('This item was already sent to Lee. Choose the next product above.');
        return;
      }
      if(draft&&draft.item&&draft.item.sku!==item.sku)throw new Error('Saved product mismatch');
      if(draft&&draft.item&&Array.isArray(draft.photos)){
        var files=[];
        for(var i=0;i<draft.photos.length;i++){
          var ref=draft.photos[i], original=(result.originals||[]).find(function(o){return o.normalizedSha256===ref.sha256;}), controller=new AbortController();
          var photoTimeout=setTimeout(function(){controller.abort();},45000);
          var response;
          try{response=await fetch(original?original.signedUrl:ref.signedUrl,{signal:controller.signal});
          if(!response.ok)throw new Error('Photo recovery failed');
          var recoveredFile=new File([await response.blob()],original?original.originalName:(ref.originalName||'photo.jpeg'),{type:original?original.mimeType:'image/jpeg'});
          if(original&&(recoveredFile.size!==original.sizeBytes||await hash(recoveredFile)!==original.sha256))throw new Error('Original recovery checksum mismatch');
          files.push(recoveredFile);if(original)originalCache[photoKey(item,original.sha256)+'|'+ref.sha256]=original;
          }finally{clearTimeout(photoTimeout);}
          delete ref.signedUrl;cache[photoKey(item,ref.sha256)]=ref;
        }
        if(generation!==recoveryGeneration||studio.getState().sku!==item.sku||studio.getState().reviewToken!==token)return;
        await studio.restoreCloud(Object.assign({},draft.item,{reviewToken:token,photoSlots:draft.photos.map(function(ref){var match=String(ref.originalName||'').match(/-slot(\d+)\.jpeg$/);return match?Number(match[1]):null;})}),files,false,(result.originals||[]).length?draft.photos.map(function(ref){return (result.originals||[]).some(function(o){return o.normalizedSha256===ref.sha256;});}):[]);
        recoveredDraft={id:item._draftId,updatedAt:draft.updatedAt||'',photoCount:files.length};
        say(files.length+' photos recovered from the cloud ✓'+((result.originals||[]).length?' Full originals verified.':' Saved review photos; full originals unavailable.'));
      }else say('Photos will save to the cloud as you take them.');
    }catch(error){if(generation===recoveryGeneration){recoveryFailed=true;say('Could not check cloud recovery. Keep this page open and tap Retry saving photos.',true);}}
    finally{if(generation===recoveryGeneration){recovering=false;photoGate(recoveryFailed||stopped);}}
  }
  function beginRecovery(){recoveryTask=recover();return recoveryTask;}
  retry.onclick=function(){if(recoveryFailed)beginRecovery();else saveNow().catch(function(){});};
  document.addEventListener('ech:draftChanged',schedule);
  document.addEventListener('ech:originalAdded',function(){originalAutoConsent=window.ECHStudio.getState()._draftId;schedule();});
  document.addEventListener('ech:loadPrepared',beginRecovery);
  document.addEventListener('ech:queueSynced',function(){
    // The first read can fail before PIN queue renewal completes. Await that
    // read, then retry once with the now-accepted permission. Never clear photos.
    Promise.resolve(recoveryTask).then(function(){if(recoveryFailed&&!recovering)beginRecovery();});
  });
  window.addEventListener('online',function(){if(!recovering){if(recoveryFailed)beginRecovery();else saveNow().catch(function(){});}});
  window.ECHCloud={recoveredDraft:function(){return recoveredDraft;},isSubmitted:function(){return stopped;},flush:saveNow,ready:async function(){await recoveryTask;if(recoveryFailed)throw new Error('Cloud recovery needs a retry.');},
    retryRecovery:async function(){if(recovering)await recoveryTask;else await beginRecovery();if(recoveryFailed)throw new Error('Cloud recovery could not be confirmed. Keep this item open and tap Retry saving photos.');},
    resetEmpty:function(){
      // Called only after the explicit fresh-item confirmation and cleared form.
      // Never deletes a cloud draft, and never bypasses saving in-memory photos.
      if(window.ECHStudio.photoCount()||window.ECHStudio.getState().reviewToken)throw new Error('Finish saving this item first.');
      clearTimeout(timer);recoveryGeneration++;recovering=false;recoveryFailed=false;stopped=false;
      recoveryTask=Promise.resolve();photoGate(false);say('Choose the next approved product above.');
    },archiveOriginals:archiveOriginals,submitted:function(){stopped=true;clearTimeout(timer);say('Sent to Lee. Photos are safely stored ✓');}};
  beginRecovery();
})();
