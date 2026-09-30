(function(){
  'use strict';
  var KEY='ech-paige-session-v1';
  var ENDPOINT='https://qrhajotxduywvqmztvjq.supabase.co/functions/v1/ech-paige-pin';
  var $=function(id){return document.getElementById(id);};
  function token(){try{return localStorage.getItem(KEY)||'';}catch(e){return '';}}
  function show(message){$('pinConnect').hidden=false;$('pinStatus').textContent=message||'';}
  async function request(action,pin){
    var headers={'Content-Type':'application/json'};
    if(action!=='login')headers.Authorization='Bearer '+token();
    var response=await fetch(ENDPOINT,{method:'POST',headers:headers,
      body:JSON.stringify(action==='login'?{action:action,pin:pin}:{action:action}),
      signal:AbortSignal.timeout(15000),cache:'no-store'});
    var data=await response.json();
    if(!response.ok||data.error){var error=new Error(data.error||'unavailable');error.code=data.error;throw error;}
    return data;
  }
  window.ECHPin={
    connected:function(){return !!token();},
    prompt:show,
    list:async function(){
      try{var data=await request('queue');return data.items;}
      catch(e){if(e.code==='unauthorized'){localStorage.removeItem(KEY);show('Please enter your PIN to reconnect.');$('pinSignOut').hidden=true;}throw e;}
    }
  };
  $('pinForm').addEventListener('submit',async function(e){
    e.preventDefault();var pin=$('paigePin').value;
    if(!/^[0-9]{6}$/.test(pin)){show('Please enter all 6 numbers.');return;}
    $('pinSubmit').disabled=true;$('pinStatus').textContent='Connecting…';
    try{
      var result=await request('login',pin);
      // Never persist the PIN. Only the revocable 30-day session is saved.
      localStorage.setItem(KEY,result.token);
      $('paigePin').value='';$('pinConnect').hidden=true;$('pinSignOut').hidden=false;
      document.dispatchEvent(new CustomEvent('ech:pinConnected'));
    }catch(error){
      $('paigePin').value='';
      show(error.code==='locked'?'Too many tries. Wait 15 minutes, then try again. If it still stops you, ask Lee.':
        error.code==='invalid_pin'?'That PIN did not match. Please try again.':
        error.code==='not_ready'?'Lee is finishing the PIN setup. Your saved work is safe.':
        'Could not connect. Check your internet and try again.');
    }finally{$('pinSubmit').disabled=false;}
  });
  $('pinSignOut').hidden=!token();
  $('pinConnectButton').hidden=!!token();
  $('pinConnectButton').addEventListener('click',function(){show();$('paigePin').focus();});
  $('pinSignOut').addEventListener('click',async function(){
    if(!confirm('Disconnect this device? Finish sending any photos to Lee first.'))return;
    this.disabled=true;
    try{
      await request('logout');localStorage.removeItem(KEY);
      localStorage.removeItem('ech-ready-queue-token-v1');
      // Keep photo work intact; remove only cached approved-product credentials.
      localStorage.removeItem('ech-prepared-items-v1');
      location.reload();
    }catch(e){show('Could not disconnect safely. Check your internet and try again.');}
    finally{this.disabled=false;}
  });
})();
