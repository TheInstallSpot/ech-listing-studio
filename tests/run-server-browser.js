(function(){
 'use strict';var out=document.getElementById('serverFlowResult'),tests=[];
 function ok(condition,test){if(!condition)throw new Error(test);tests.push({test:test,status:'PASS'});out.textContent=JSON.stringify(tests,null,2);}
 async function waitFor(fn){for(var i=0;i<150;i++){if(fn())return;await new Promise(function(r){setTimeout(r,100);});}throw new Error('Timed out waiting for workflow');}
 function edit(id,value){var el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}
 async function photo(){var cv=document.createElement('canvas');cv.width=1800;cv.height=1700;var c=cv.getContext('2d');c.fillStyle='#123d68';c.fillRect(0,0,1800,1700);c.fillStyle='#d7a72d';c.fillRect(300,400,800,700);return new Promise(function(resolve){cv.toBlob(function(b){resolve(new File([b],'local-original.png',{type:'image/png'}));},'image/png');});}
 async function hash(blob){var data=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());return Array.from(new Uint8Array(data)).map(function(v){return v.toString(16).padStart(2,'0');}).join('');}
 async function record(phase){await fetch('/__test/evidence',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phase:phase,mode:'actual-app/actual-receiver/actual-SQL/local-storage',tests:tests})});}
 async function run(){tests=[];try{
  if(!window.ECHPin.connected()){edit('paigePin','123456');document.getElementById('pinForm').requestSubmit();}
  await waitFor(function(){return window.ECHPin.connected()&&document.getElementById('preparedSelect').options.length===3;});
  ok(document.getElementById('preparedSelect').options.length===3,'Actual PIN flow loads two approved jobs and excludes held job');
  var sel=document.getElementById('preparedSelect');sel.value='0';sel.dispatchEvent(new Event('change',{bubbles:true}));
  await waitFor(function(){return window.ECHStudio.getState().sku==='LOCAL-E2E-SPEAKER';});await window.ECHCloud.ready();await window.ECHDrafts.ready();
  var initial=window.ECHStudio.getState();ok(!initial.cond,'Approved server job does not preselect physical condition');ok(!initial.targetPrice&&!initial.researchNotes,'Server queue hides commercial research from operator');
  var radio=document.querySelector('input[name=cond][value="N1"]');radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));var confirm=document.getElementById('quantityConfirmed');confirm.checked=true;confirm.dispatchEvent(new Event('change',{bubbles:true}));
  edit('serialNumber','PRIVATE-LOCAL-SERIAL');edit('productdesc','Operator correction preserved across reopen');edit('defects','Remote missing');
  var original=await photo();window.ECHStudio.addPhotoFiles([original]);await waitFor(function(){return window.ECHStudio.photoCount()===1;});
  await window.ECHDrafts.flush();await window.ECHCloud.flush();
  ok(document.getElementById('cloudSaveStatus').textContent.indexOf('saved securely')!==-1,'Actual JPEG upload and draft SQL return durable cloud acknowledgment');
  var local=await window.ECHDraftStore.read(initial._draftId);ok(await hash(local.photos[0].original)===await hash(original),'Full-resolution original persists byte-for-byte on device');
  var details={id:initial._draftId,sku:initial.sku,originalHash:await hash(original),text:window.ECHStudio.getState().pdesc};localStorage.setItem('ech-real-server-resume',JSON.stringify(details));
  ok(!window.ECHStudio.prepareReview().issues.length,'App packet is ready for exact server validation');
  await record('capture');out.textContent+='\nReady for reopen verification.';
 }catch(e){tests.push({test:e.message,status:'FAIL'});out.textContent=JSON.stringify(tests,null,2);await record('capture');}}
 document.getElementById('runServerFlow').onclick=run;
 var phase=new URL(location.href).searchParams.get('phase');
 if(phase==='resume')(async function(){try{
  await window.ECHCloud.ready();await window.ECHDrafts.ready();var expected=JSON.parse(localStorage.getItem('ech-real-server-resume')),snap=window.ECHStudio.snapshotDraft();
  ok(snap.id===expected.id&&snap.item.pdesc===expected.text,'Reopen recovers exact job and operator correction');ok(snap.photos.length===1&&await hash(snap.photos[0].original)===expected.originalHash,'Reopen restores original bytes with real server recovery');
  await fetch('/__test/control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({afterCommit:true})});
  document.getElementById('sendToLee').click();await waitFor(function(){return document.getElementById('handoffStatus').textContent.indexOf('Sent to Lee')!==-1;});
  ok(document.getElementById('handoffStatus').textContent.indexOf('Nothing was published')!==-1,'Actual send handler completes real receiver and SQL receipt after lost commit response');
  var received=await(await fetch('/__test/receipts')).json(),r=received.reviews.find(function(r){return r.queue_id===expected.id;});
  ok(r&&r.photo_count===1&&r.review_status==='awaiting_lee_approval','Independent database read confirms receipt and complete photo count');ok(!r.listing_id&&!r.published_at,'Operator submission cannot publish eBay listing');ok(!r.listing.descriptionHtml.includes('PRIVATE-LOCAL-SERIAL')&&r.listing.item.serialRecorded,'Private serial is retained for review and absent from public HTML');
  document.getElementById('syncApprovals').click();await waitFor(function(){return document.getElementById('preparedSelect').options.length===2;});ok(true,'Completed job leaves actual server queue and same-SKU sibling remains');
  await record('resume');
 }catch(e){tests.push({test:e.message,status:'FAIL'});out.textContent=JSON.stringify(tests,null,2);await record('resume');}})();
 if(phase==='restart')(async function(){try{
  await window.ECHCloud.ready();await window.ECHDrafts.ready();var expected=JSON.parse(localStorage.getItem('ech-real-server-resume'));
  var received=await(await fetch('/__test/receipts')).json();ok(received.reviews.filter(function(r){return r.queue_id===expected.id;}).length===1,'Server restart preserves one PostgreSQL receipt');
  ok(document.getElementById('sendToLee').disabled,'Receipt recovery after server restart blocks duplicate submission');
  await window.ECHPin.list();ok(true,'Saved authenticated session reconnects after server restart');await record('restart');
 }catch(e){tests.push({test:e.message,status:'FAIL'});out.textContent=JSON.stringify(tests,null,2);await record('restart');}})();
 if(phase==='next')(async function(){try{
  await window.ECHCloud.ready();await window.ECHDrafts.ready();var previous=window.ECHStudio.getState()._draftId;
  await waitFor(function(){return document.getElementById('preparedSelect').options.length===2;});
  var sel=document.getElementById('preparedSelect');sel.value='0';sel.dispatchEvent(new Event('change',{bubbles:true}));
  await waitFor(function(){return window.ECHStudio.getState()._draftId!==previous;});await window.ECHCloud.ready();await window.ECHDrafts.ready();
  ok(window.ECHStudio.photoCount()===0,'Next physical job with identical SKU does not inherit prior photos');
  ok(!window.ECHStudio.getState().cond&&!window.ECHStudio.getState().quantityConfirmed,'Next physical job requires fresh condition and contents confirmation');
  ok(!window.ECHStudio.getState().serialNumber,'Next physical job does not inherit private serial');await record('next');
 }catch(e){tests.push({test:e.message,status:'FAIL'});out.textContent=JSON.stringify(tests,null,2);await record('next');}})();
})();
