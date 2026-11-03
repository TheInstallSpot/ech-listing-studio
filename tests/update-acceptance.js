(function(){
 'use strict';var out=document.getElementById('updateResult'),tests=[];
 function ok(value,test){if(!value)throw Error(test);tests.push({test:test,status:'PASS'});out.textContent=JSON.stringify(tests,null,2);}
 async function hash(file){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(function(x){return x.toString(16).padStart(2,'0');}).join('');}
 async function read(){var form=new FormData();form.append('mode','draft-read');var r=await fetch(window.ECH_REVIEW_ENDPOINT,{method:'POST',headers:{Authorization:'Bearer '+window.ECHStudio.getState().reviewToken},body:form});if(!r.ok)throw Error('Read failed');return r.json();}
 async function evidence(phase){await fetch('/__test/evidence',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phase:phase,scope:'real local service worker and IndexedDB; candidate receiver/localSQL; no production',tests:tests})});}
 document.getElementById('installCandidate').onclick=async function(){try{
  await window.ECHDrafts.flush();var refs=await window.ECHCloud.flush();await window.ECHCloud.archiveOriginals(refs);
  var snap=window.ECHStudio.snapshotDraft();if(!snap.photos.length)throw Error('Run capture first');
  var expected={id:snap.id,text:snap.item.pdesc,hashes:await Promise.all(snap.photos.map(function(p){return hash(p.original);}))};
  localStorage.setItem('ech-upgrade-expected',JSON.stringify(expected));
  await navigator.serviceWorker.register('/sw.js');
  await Promise.race([navigator.serviceWorker.ready,new Promise(function(resolve,reject){setTimeout(function(){reject(Error('Initial local worker did not activate within15seconds'));},15000);})]);
  var other=await caches.open('qa-unrelated-cache');await other.put('/qa-sentinel',new Response('keep'));
  await fetch('/__test/control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({release:'candidate'})});
  var reg=await navigator.serviceWorker.getRegistration();await reg.update();
  if(reg.installing)await new Promise(function(resolve,reject){var worker=reg.installing;worker.addEventListener('statechange',function(){if(worker.state==='activated')resolve();if(worker.state==='redundant')reject(Error('Worker install failed'));});});
  ok((await caches.keys()).indexOf('ech-studio-local-originals-v24rc18-ready2')!==-1,'New service worker installed its complete cache');
  ok((await caches.keys()).indexOf('qa-unrelated-cache')!==-1,'Other app cache survives update');
  // The still-open rc17 client must continue saving before the new page opens.
  var field=document.getElementById('productdesc');field.value+=' / old tab after update';field.dispatchEvent(new Event('input',{bubbles:true}));
  await window.ECHDrafts.flush();await window.ECHCloud.flush();var remote=await read();
  expected.text=field.value;localStorage.setItem('ech-upgrade-expected',JSON.stringify(expected));
  ok(remote.snapshot.item.pdesc===field.value,'Still-open old app can save after worker/backend update');
  await evidence('old-app-update');
 }catch(e){tests.push({test:e.message,status:'FAIL'});out.textContent=JSON.stringify(tests,null,2);await evidence('old-app-update');}};
 document.getElementById('checkCandidate').onclick=function(){location.assign('/?phase=update-check');};
 if(new URL(location.href).searchParams.get('phase')==='update-check')(async function(){try{
  await window.ECHCloud.ready();await window.ECHDrafts.ready();var expected=JSON.parse(localStorage.getItem('ech-upgrade-expected')),snap=window.ECHStudio.snapshotDraft();
  ok(snap.id===expected.id&&snap.item.pdesc===expected.text,'Updated app restores exact old draft and correction');
  ok(JSON.stringify(await Promise.all(snap.photos.map(function(p){return hash(p.original);})))===JSON.stringify(expected.hashes),'Updated app retains byte-identical originals');
  ok(!snap.item.cond,'Updated app keeps condition unselected');
  ok(Array.from(document.scripts).filter(function(s){return s.src&&s.src.indexOf('/tests/')===-1;}).every(function(s){return s.src.indexOf('24rc18-ready2')!==-1;}),'Updated HTML loads all nine scripts from the candidate release');
  await window.ECHCloud.flush();var remote=await read();ok(remote.snapshot._protocol===2,'Recovered app advances the modern revision contract');
  ok((await caches.keys()).indexOf('ech-studio-local-originals-v24rc17')!==-1,'Old shell cache retained for old open clients');
  await evidence('updated-app-recovery');
 }catch(e){tests.push({test:e.message,status:'FAIL'});out.textContent=JSON.stringify(tests,null,2);await evidence('updated-app-recovery');}})();
})();
