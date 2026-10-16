(function(){
  'use strict';
  var studio=window.ECHStudio,store=window.ECHDraftStore,serial=Promise.resolve(),restoring=true,generation=0,lastError=null,recoveryTask=null,recoveryFailed=false;
  var timer,urls=[],archive=document.createElement('details');archive.innerHTML='<summary>Saved originals on this device</summary><p>Keep exported originals as a backup. Clean eBay photos are separate.</p><div></div>';
  var status=document.createElement('p');status.id='localDraftStatus';status.setAttribute('role','status');
  document.getElementById('photoSummary').after(status);status.after(archive);
  async function showOriginals(){var id=studio.getState()._draftId,list=await store.readOriginals(id);if(id!==studio.getState()._draftId)return;urls.forEach(function(u){URL.revokeObjectURL(u);});urls=[];var host=archive.querySelector('div');host.textContent='';list.filter(function(p){return p.originalAvailable!==false;}).forEach(function(p){var a=document.createElement('a');var url=URL.createObjectURL(p.original);urls.push(url);a.href=url;a.download=p.name;a.textContent='Save original: '+p.name;a.style.display='block';host.appendChild(a);});}
  function say(s){status.textContent=s;}
  function enqueue(){
    if(restoring)return;
    var snapshot=studio.snapshotDraft();if(!snapshot.item.sku&&!snapshot.item.part)return;
    serial=serial.catch(function(){}).then(function(){return store.write(snapshot);}).then(function(){lastError=null;showOriginals().catch(function(){});say('Originals and changes saved on this device. Check the cloud confirmation below.');},function(e){lastError=e;say('Not saved on this device. Keep this page open; free storage and retry.');});
  }
  async function recover(){
    var g=++generation;restoring=true;recoveryFailed=false;
    var current=studio.getState(),id=current._draftId;
    try{
      var record=id?await store.read(id):null;
      if(window.ECHCloud)try{await window.ECHCloud.ready();}catch(e){/* Local recovery never certifies cloud success. */}
      if(g!==generation)return;
      var cloud=window.ECHCloud&&window.ECHCloud.recoveredDraft&&window.ECHCloud.recoveredDraft();
      var newerCloud=cloud&&cloud.id===id&&Date.parse(cloud.updatedAt)>Date.parse(record&&record.updatedAt||'');
      if(record&&record.item.sku===studio.getState().sku&&!newerCloud&&!(window.ECHCloud&&window.ECHCloud.isSubmitted())){
        await studio.restoreLocalDraft(record);say('Your saved originals and changes are back.');
      }
    }catch(e){lastError=e;recoveryFailed=true;say('Could not recover local originals. Keep this page open and ask Lee.');}
    finally{if(g===generation){restoring=false;if(!recoveryFailed)enqueue();}}
  }
  document.addEventListener('ech:draftChanged',function(){clearTimeout(timer);timer=setTimeout(enqueue,300);});
  function begin(){recoveryTask=recover();return recoveryTask;}
  document.addEventListener('ech:loadPrepared',begin);
  window.ECHDrafts={flush:async function(){clearTimeout(timer);await recoveryTask;if(recoveryFailed)throw lastError;enqueue();await serial;if(lastError)throw lastError;},ready:async function(){await recoveryTask;}};
  begin();
})();
