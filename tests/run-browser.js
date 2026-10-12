(function(){
 'use strict';
 var result=document.getElementById('acceptanceResult'),tests=[],runId=String(Date.now());
 function ok(check,label){if(!check)throw new Error(label);tests.push({test:label,status:'PASS'});result.textContent=JSON.stringify(tests,null,2);}
 function sleep(){return new Promise(function(r){setTimeout(r,100);});}
 async function waitFor(fn){for(var i=0;i<100;i++){if(fn())return;await sleep();}throw new Error('Timed out waiting for fixture');}
 function hash(blob){return blob.arrayBuffer().then(function(b){return crypto.subtle.digest('SHA-256',b);}).then(function(b){return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,'0');}).join('');});}
 function fixture(n){return {_queueId:'fixture-'+runId+'-'+n,sku:'FIXTURE-'+runId+'-'+n,productId:'fixture-'+runId+'-'+n,brand:'Fixture',part:'QA-'+n,what:'Passive Speaker',sold:'Each',title:'Fixture QA-'+n+' Passive Speaker',pdesc:'Synthetic equipment for local tests only.',box:['One test speaker','Test grille'],spec:[['Impedance','8 ohms (fixture)']],ver:['Human confirmed fixture identity and contents.'],availableQuantity:1,fulfillment:'ech',isPassive:true,reviewToken:'fixture-'+runId+'-'+n,ebayCategoryId:'fixture-leaf',ebayCategoryName:'Test category',ebayCategoryPath:'Test',ebayCategoryVerifiedAt:'2026-10-12',researchNotes:'Synthetic source, no market recommendation or live inventory.'};}
 async function photo(color){var c=document.createElement('canvas');c.width=1800;c.height=1700;var g=c.getContext('2d');g.fillStyle=color||'#557799';g.fillRect(0,0,c.width,c.height);g.fillStyle='white';g.fillRect(300,300,800,700);return new Promise(function(r){c.toBlob(function(b){r(new File([b],'fixture-original.png',{type:'image/png'}));},'image/png');});}
 async function run(){tests=[];document.getElementById('runAcceptance').disabled=true;try{
  await window.ECHDrafts.ready();
  var cases=[['N1','new_in_box'],['N1','open_box'],['D3','other'],['O2','other'],['O2','other'],['O2','other']];
  for(var i=0;i<cases.length;i++){
   if(i)await window.ECHDrafts.flush();var f=fixture(i);if(i===5)f.spec=[];
   document.dispatchEvent(new CustomEvent('ech:loadPrepared',{detail:f}));await window.ECHCloud.ready();await window.ECHDrafts.ready();
   ok(!window.ECHStudio.getState().cond,'Case '+i+': no condition preselected');
   var confirmation=document.getElementById('quantityConfirmed');confirmation.checked=true;confirmation.dispatchEvent(new Event('change',{bubbles:true}));
   var radio=document.querySelector('input[name=cond][value="'+cases[i][0]+'"]');radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));
   var packaging=document.getElementById('packaging');packaging.value=cases[i][1];packaging.dispatchEvent(new Event('input',{bubbles:true}));
   if(i===4){var defects=document.getElementById('defects');defects.value='Remote missing; cabinet scratched.';defects.dispatchEvent(new Event('input',{bubbles:true}));}
   var original=await photo();window.ECHStudio.addPhotoFiles([original]);await waitFor(function(){return window.ECHStudio.photoCount()===1;});
   await window.ECHDrafts.flush();var record=await window.ECHDraftStore.read(f._queueId);
   ok(await hash(record.photos[0].original)===await hash(original),'Case '+i+': original bytes persist intact');
   ok(!record.item.reviewToken,'Case '+i+': local original store excludes credential');
   var pack=window.ECHStudio.prepareReview();ok(pack.files[0].type==='image/jpeg'&&pack.issues.length===0,'Case '+i+': complete clean JPEG review package');
   ok(pack.pack.descriptionHtml.indexOf('Amplification is not included')!==-1,'Case '+i+': passive buyer warning exported');
   ok(!/serialNumber/.test(pack.pack.descriptionHtml),'Case '+i+': private serial not in buyer HTML');
   if(i===4)ok(pack.pack.descriptionHtml.indexOf('Remote missing')!==-1,'Missing accessories disclosed in HTML');
   if(i===5)ok(pack.pack.warnings.length===1,'Incomplete specifications explicitly flagged');
   var ref=(await window.ECHStudio.exportReferencePhotos())[0];ok(await hash(ref)!==await hash(pack.files[0]),'Case '+i+': watermark copy distinct from clean eBay output');
   var condition=pack.pack.item.cond;ok(condition===cases[i][0],'Case '+i+': human condition retained');
   var correction=document.getElementById('productdesc');correction.value='Paige correction for case '+i;correction.dispatchEvent(new Event('input',{bubbles:true}));await window.ECHDrafts.flush();
   await window.ECHStudio.restoreCloud(Object.assign({},f,{cond:'N1',pdesc:'Old research text'}),[]);
   ok(window.ECHStudio.getState().pdesc==='Paige correction for case '+i,'Case '+i+': stale cloud recovery cannot overwrite correction');
   ok(window.ECHStudio.photoCount()===1,'Case '+i+': recovery preserves captured photo');
  }
  var setItem=Storage.prototype.setItem;
  try{
   Storage.prototype.setItem=function(key,value){if(key==='ech-studio-v1')throw new Error('Legacy cache full');return setItem.call(this,key,value);};
   var correction=document.getElementById('productdesc');correction.value='Correction survives legacy cache quota';correction.dispatchEvent(new Event('input',{bubbles:true}));
   await window.ECHDrafts.flush();
   var quotaRecord=await window.ECHDraftStore.read(window.ECHStudio.getState()._draftId);
   ok(quotaRecord.item.pdesc===correction.value,'Legacy text-cache quota does not suppress IndexedDB corrections');
   ok(quotaRecord.photos.length===1,'Legacy text-cache quota preserves original photo persistence');
  }finally{Storage.prototype.setItem=setItem;}
  var form=new FormData();form.append('mode','fail-next');await fetch('/mock-review',{method:'POST',body:form,headers:{Authorization:'Bearer fixture-5'}});
  var second=await photo('#997755');window.ECHStudio.addPhotoFiles([second]);await waitFor(function(){return window.ECHStudio.photoCount()===2;});
  var failed=false;try{await window.ECHCloud.flush();}catch(e){failed=true;}ok(failed,'Simulated cloud upload failure is reported');ok(window.ECHStudio.photoCount()===2,'Failed upload preserves both photos');await window.ECHDrafts.flush();await window.ECHCloud.flush();ok(true,'Retry completes cloud fixture save');
  var writer=window.ECHDraftStore.write;window.ECHDraftStore.write=async function(){throw new Error('Simulated local quota failure');};var localFailed=false;try{await window.ECHDrafts.flush();}catch(e){localFailed=true;}ok(localFailed&&window.ECHStudio.photoCount()===2,'Local storage failure blocks advancement and preserves photos');window.ECHDraftStore.write=writer;await window.ECHDrafts.flush();
  var archive=await window.ECHDraftStore.readOriginals(window.ECHStudio.getState()._draftId);ok(archive.length===2,'All captured original images are archived by item and content');var snapshot=window.ECHStudio.snapshotDraft();await window.ECHDraftStore.write(Object.assign({},snapshot,{photos:[]}));ok((await window.ECHDraftStore.readOriginals(snapshot.id)).length===2,'Removing listing photos cannot erase original archive');await window.ECHDrafts.flush();
  var before=await window.ECHDraftStore.count();await window.ECHDrafts.flush();ok(await window.ECHDraftStore.count()===before,'Repeat processing does not duplicate item record');
  window.ECHStudio.addPhotoFiles([new File(['invalid image'],'bad.png',{type:'image/png'})]);await waitFor(function(){var toast=document.querySelector('.toast');return toast&&toast.textContent.indexOf('could not be opened')!==-1;});ok(window.ECHStudio.photoCount()===2,'Invalid photo is explained without corrupting captured photos');
  var last=window.ECHStudio.snapshotDraft();await window.ECHDrafts.flush();localStorage.setItem('ech-acceptance-resume',JSON.stringify({id:last.id,sku:last.item.sku,text:last.item.pdesc,hash:await hash(last.photos[0].original)}));
  tests.push({test:'Close/reopen durability',status:'AWAITING_RELOAD'});result.textContent=JSON.stringify(tests,null,2);await fetch('/evidence',{method:'POST',body:JSON.stringify({tests:tests,mode:'local-browser/synthetic/mock-backend'})});
 }catch(e){tests.push({test:'Acceptance failure',status:'FAIL',error:e.message});result.textContent=JSON.stringify(tests,null,2);await fetch('/evidence',{method:'POST',body:JSON.stringify({tests:tests,mode:'local-browser/synthetic/mock-backend'})});}finally{document.getElementById('runAcceptance').disabled=false;}}
 document.getElementById('runAcceptance').onclick=run;
 if(new URL(location.href).searchParams.has('sent'))(async function(){await window.ECHCloud.ready();ok(document.getElementById('sendToLee').disabled&&document.getElementById('sendToLee').textContent.indexOf('Sent to Lee')!==-1,'Reopen recognizes prior receipt and prevents duplicate send');await fetch('/evidence',{method:'POST',body:JSON.stringify({tests:tests,mode:'local-browser/receipt-reopen'})});})();
 if(new URL(location.href).searchParams.has('resume'))(async function(){try{
  await window.ECHDrafts.ready();var expected=JSON.parse(localStorage.getItem('ech-acceptance-resume'));var snap=window.ECHStudio.snapshotDraft();ok(snap.id===expected.id&&snap.item.pdesc===expected.text,'Reopen restores exact item and correction');ok(snap.photos.length&&await hash(snap.photos[0].original)===expected.hash,'Reopen restores byte-identical original');ok(!window.ECHStudio.prepareReview().issues.length,'Reopened item remains review-ready');document.getElementById('sendToLee').click();await waitFor(function(){return document.getElementById('handoffStatus').textContent.indexOf('Sent to Lee')!==-1;});ok(document.getElementById('handoffStatus').textContent.indexOf('Nothing was published')!==-1,'Actual send handler produces mock review receipt without publication');await fetch('/evidence',{method:'POST',body:JSON.stringify({tests:tests,mode:'local-browser/reopen/mock-review'})});}catch(e){result.textContent='FAIL '+e.message;}})();
})();
