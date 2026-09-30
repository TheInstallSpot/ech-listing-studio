(function(){
  'use strict';
  var timer, busy=null, recovering=false, recoveryFailed=false, stopped=false, cache={}, revision=0;
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
    var controller=new AbortController(), timeout=setTimeout(function(){controller.abort();},45000);
    try{
      var response=await fetch(window.ECH_REVIEW_ENDPOINT,{method:'POST',body:form,headers:{Authorization:'Bearer '+token},signal:controller.signal});
      var body=await response.json();
      if(!response.ok||body.reviewId)throw new Error(body.error||'This item has already been sent to Lee.');
      return body;
    }finally{clearTimeout(timeout);}
  }
  async function hash(file){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(function(n){return n.toString(16).padStart(2,'0');}).join('');}
  async function saveNow(){
    if(recovering||recoveryFailed)throw new Error('Please wait for cloud recovery or tap Retry saving photos.');
    if(busy){await busy;return saveNow();}
    var studio=window.ECHStudio, item=studio.getState(), token=item.reviewToken, version=revision;
    if(stopped)return [];
    if(!token||!item.sku){if(studio.photoCount())throw new Error('Photos need a connected product before they can be saved.');return [];}
    var files=studio.exportPhotos();
    busy=(async function(){
      var keys=await Promise.all(files.map(async function(file){return item.sku+':'+await hash(file);}));
      var refs=keys.map(function(key){return cache[key];});
      for(var i=0;i<files.length;i++){
        var key=keys[i];
        say('Saving photo '+(i+1)+' of '+files.length+' to the cloud…');
        if(!cache[key])cache[key]=(await request('photo',token,{photo:files[i]})).photo;
        refs[i]=cache[key];
        // Each confirmed photo is attached immediately, even if a later upload fails.
        var clean=Object.assign({},item);delete clean.reviewToken;
        await request('draft-save',token,{snapshot:JSON.stringify({item:clean,photos:refs.filter(Boolean)})});
      }
      if(!files.length){var clean=Object.assign({},item);delete clean.reviewToken;await request('draft-save',token,{snapshot:JSON.stringify({item:clean,photos:[]})});}
      if(version===revision)say(files.length+' photos saved securely in the cloud ✓');
      return refs;
    })();
    try{return await busy;}catch(error){say('Not all photos are saved yet. Keep this page open and tap Retry saving photos.',true);throw error;}
    finally{busy=null;}
  }
  function schedule(){revision++;clearTimeout(timer);if(!recovering&&!stopped)timer=setTimeout(function(){saveNow().catch(function(){});},1200);}
  async function recover(){
    clearTimeout(timer);recovering=true;recoveryFailed=false;stopped=false;photoGate(true);
    var studio=window.ECHStudio,item=studio.getState(),token=item.reviewToken;
    if(!token){recovering=false;say('Choose a product to save its photos securely.');return;}
    say('Checking for saved cloud photos…');
    try{
      var result=await request('draft-read',token,{}), draft=result.snapshot;
      if(draft&&draft.item&&Array.isArray(draft.photos)&&draft.photos.length){
        var files=[];
        for(var i=0;i<draft.photos.length;i++){
          var ref=draft.photos[i], response=await fetch(ref.signedUrl);
          if(!response.ok)throw new Error('Photo recovery failed');
          files.push(new File([await response.blob()],ref.originalName||'photo.jpeg',{type:'image/jpeg'}));
          delete ref.signedUrl;cache[item.sku+':'+ref.sha256]=ref;
        }
        if(studio.getState().sku!==item.sku)return;
        await studio.restoreCloud(Object.assign({},draft.item,{reviewToken:token}),files);
        say(files.length+' photos recovered from the cloud ✓');
      }else say('Photos will save to the cloud as you take them.');
    }catch(error){recoveryFailed=true;say('Could not check cloud recovery. Keep this page open and tap Retry saving photos.',true);}
    finally{recovering=false;photoGate(recoveryFailed);}
  }
  retry.onclick=function(){if(recoveryFailed)recover();else saveNow().catch(function(){});};
  document.addEventListener('ech:draftChanged',schedule);
  document.addEventListener('ech:loadPrepared',function(){recover();});
  window.addEventListener('online',function(){if(!recovering)saveNow().catch(function(){});});
  window.ECHCloud={flush:saveNow,submitted:function(){stopped=true;clearTimeout(timer);say('Sent to Lee. Photos are safely stored ✓');}};
  recover();
})();
