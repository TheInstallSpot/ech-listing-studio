(async function(){
 var out=document.getElementById('serverFlowResult'),tests=[];out.textContent='Checking saved backend after process restart…';
 function ok(condition,test){if(!condition)throw new Error(test);tests.push({test:test,status:'PASS'});out.textContent=JSON.stringify(tests,null,2);}
 function hash(blob){return blob.arrayBuffer().then(function(b){return crypto.subtle.digest('SHA-256',b);}).then(function(b){return Array.from(new Uint8Array(b)).map(function(n){return n.toString(16).padStart(2,'0');}).join('');});}
 try{
  await window.ECHCloud.ready();await window.ECHDrafts.ready();var expected=JSON.parse(localStorage.getItem('ech-real-server-resume'));
  var received=await(await fetch('/__test/receipts')).json();ok(received.reviews.filter(function(r){return r.queue_id===expected.id;}).length===1,'New server process recovers the one committed PostgreSQL receipt');
  var queue=await window.ECHPin.list();ok(queue.length===1&&queue[0].queueId!==expected.id,'Saved session and sibling queue reconnect after process restart');
  var originals=await window.ECHDraftStore.readOriginals(expected.id);ok(originals.length===1&&await hash(originals[0].original)===expected.originalHash,'Original archive survives completed job and server process restart');
 }catch(e){tests.push({test:e.message,status:'FAIL'});out.textContent=JSON.stringify(tests,null,2);}
 await fetch('/__test/evidence',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phase:'process-restart',mode:'new-server-process/actual-app/actual-SQL',tests:tests})});
})();
