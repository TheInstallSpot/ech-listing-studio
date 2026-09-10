/* ECH Listing Studio — merged Badge Stamper + Listing Builder, iPad-first PWA.
   Reuses window.ECH_BADGE (badge images) and window.ECHCore (listing HTML generator),
   both extracted verbatim from the original tools so output is identical. */
(function(){
  "use strict";
  var $ = function(s,r){ return (r||document).querySelector(s); };
  var $$ = function(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };
  var BADGE = window.ECH_BADGE, CORE = window.ECHCore;
  var SAVE_KEY = "ech-studio-v1";

  /* ---------- badge image preload ---------- */
  var badgeImg = {}, badgeReady = {};
  Object.keys(BADGE).forEach(function(k){
    var im = new Image();
    im.onload = function(){ badgeReady[k] = true; drawShots(); };
    im.src = BADGE[k]; badgeImg[k] = im;
  });

  /* ---------- shared state ---------- */
  var step = 1;
  var photos = []; // {name, img}

  function cond(){ var r = $('input[name=cond]:checked'); return r ? r.value : ""; }

  /* =======================================================
     STEP NAVIGATION
  ======================================================= */
  function go(n){
    step = Math.max(1, Math.min(4, n));
    $$('.panel').forEach(function(p){ p.classList.toggle('active', +p.dataset.step === step); });
    $$('.rail .st').forEach(function(s){
      var sn = +s.dataset.step;
      s.classList.toggle('active', sn === step);
      s.classList.toggle('complete', sn < step);
    });
    var back = $('#navBack'), next = $('#navNext');
    back.disabled = step === 1;
    next.textContent = step === 4 ? "Start next item  ↻" : "Next  →";
    window.scrollTo({top:0, behavior:'smooth'});
  }
  $('#navBack').addEventListener('click', function(){ go(step-1); });
  $('#navNext').addEventListener('click', function(){
    if(step === 4){ startOver(); return; }
    if(step === 1 && !cond()){ toast('Choose the condition before going on'); return; }
    go(step+1);
  });
  $$('.rail .st').forEach(function(s){ s.addEventListener('click', function(){ var target=+s.dataset.step; if(step===1 && target>1 && !cond()){ toast('Choose the condition before going on'); return; } go(target); }); });

  /* =======================================================
     STEP 2 — PHOTOS  (badge stamping)
  ======================================================= */
  function cornerBusy(cv, x, y, w, h){
    try{
      var d = cv.getContext('2d').getImageData(Math.max(0,x), Math.max(0,y),
                Math.min(w, cv.width-x), Math.min(h, cv.height-y)).data;
      var n = d.length/4, sum=0, sq=0;
      for(var i=0;i<d.length;i+=4){ var l=(d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114); sum+=l; sq+=l*l; }
      var mean=sum/n;
      return Math.sqrt(Math.max(sq/n - mean*mean,0)) > 46;
    }catch(e){ return false; }
  }

  function stamp(f){ // returns {dataUrl, w, h, small, busy}
    var c = cond(); var badge = badgeImg[c];
    var cv = document.createElement('canvas');
    cv.width = f.img.naturalWidth; cv.height = f.img.naturalHeight;
    var g = cv.getContext('2d');
    g.drawImage(f.img, 0, 0);
    var pct = +$('#size').value/100, mar = +$('#margin').value/1000, corner = $('#corner').value;
    var bw = cv.width * pct;
    var bh = bw * (badge.naturalHeight / badge.naturalWidth);
    var m = cv.width * mar;
    var bx = (corner==="tr"||corner==="br") ? cv.width-bw-m : m;
    var by = (corner==="bl"||corner==="br") ? cv.height-bh-m : m;
    var busy = cornerBusy(cv, bx, by, bw, bh);
    g.drawImage(badge, bx, by, bw, bh);
    var longest = Math.max(cv.width, cv.height);
    return { dataUrl: cv.toDataURL('image/jpeg', 0.93), w:cv.width, h:cv.height, small:longest<1600, busy:busy };
  }

  function drawShots(){
    var host = $('#shots');
    if(!photos.length){ host.innerHTML = '<div class="empty">No photos yet. Use the buttons above to take or choose photos.</div>'; return; }
    var c = cond();
    if(!badgeReady[c]) return;
    host.innerHTML = "";
    photos.forEach(function(f){
      var r = stamp(f);
      var base = f.name.replace(/\.[^.]+$/, "");
      var el = document.createElement('div');
      el.className = 'shot';
      el.innerHTML =
        '<img alt="stamped photo" src="'+r.dataUrl+'">'+
        '<div class="meta">'+
          '<p class="fn">'+base.replace(/[<>&]/g,'')+'-'+c+'.jpg</p>'+
          '<p class="flag">'+r.w+' × '+r.h+' &middot; '+
            (r.small ? '<span class="bad">too small &mdash; retake bigger</span>'
                     : '<span class="ok">good size, buyers can zoom</span>')+
            (r.busy ? ' &middot; <span class="bad">corner looks busy</span>' : '')+
          '</p>'+
          '<p class="savehint">Press &amp; hold the photo → <b>Save to Photos</b>. Or tap Save.</p>'+
          '<button class="save1" type="button">↓  Save this photo</button>'+
        '</div>';
      el.querySelector('.save1').addEventListener('click', function(){
        var a = document.createElement('a');
        a.href = r.dataUrl; a.download = base+'-'+c+'.jpg'; a.click();
        toast('Saved '+base+'-'+c+'.jpg');
      });
      host.appendChild(el);
    });
  }

  function addFiles(list){
    Array.prototype.forEach.call(list, function(file){
      if(!/^image\//.test(file.type)) return;
      var rd = new FileReader();
      rd.onload = function(){
        var im = new Image();
        im.onload = function(){ photos.push({name:file.name||('photo-'+(photos.length+1)+'.jpg'), img:im}); drawShots(); };
        im.src = rd.result;
      };
      rd.readAsDataURL(file);
    });
  }
  $('#camIn').addEventListener('change', function(e){ addFiles(e.target.files); e.target.value=""; });
  $('#libIn').addEventListener('change', function(e){ addFiles(e.target.files); e.target.value=""; });
  $('#takePhoto').addEventListener('click', function(){ $('#camIn').click(); });
  $('#choosePhoto').addEventListener('click', function(){ $('#libIn').click(); });
  $('#clearPhotos').addEventListener('click', function(){ photos=[]; drawShots(); });
  ['#corner','#size','#margin'].forEach(function(id){ $(id).addEventListener('input', function(){
    if(id==='#size') $('#szv').textContent=$('#size').value+'%';
    if(id==='#margin') $('#mgv').textContent=(+$('#margin').value/10).toFixed(1)+'%';
    drawShots();
  }); });

  /* =======================================================
     STEP 3 — DETAILS  (listing builder form)
  ======================================================= */
  var SEED_SPEC = [["Configuration",""],["Certification",""],["Cutout",""],["Mounting depth",""],["Impedance",""]];

  function mkRow(kind, a, b){
    var w = document.createElement('div'); w.className='row';
    var i1 = document.createElement('input'); i1.type='text'; i1.value=a||"";
    i1.placeholder = kind==='spec' ? 'Name (like Impedance)' : (kind==='box' ? 'One thing in the box' : 'One thing you checked');
    if(kind==='spec') i1.style.flex='0 0 44%';
    w.appendChild(i1);
    if(kind==='spec'){ var i2=document.createElement('input'); i2.type='text'; i2.value=b||""; i2.placeholder='Value'; w.appendChild(i2); }
    var del=document.createElement('button'); del.type='button'; del.className='del'; del.textContent='×';
    del.setAttribute('aria-label','Remove row');
    del.addEventListener('click', function(){ w.remove(); onChange(); });
    w.appendChild(del);
    w.addEventListener('input', onChange);
    return w;
  }
  function addRow(kind,a,b){ $('#'+kind+'Rows').appendChild(mkRow(kind,a,b)); }
  function readRows(kind, isSpec){
    var out=[];
    $$('#'+kind+'Rows .row').forEach(function(r){
      var ins=r.querySelectorAll('input');
      if(isSpec){ var l=ins[0].value.trim(), v=ins[1].value.trim(); if(l||v) out.push([l,v]); }
      else { var t=ins[0].value.trim(); if(t) out.push(t); }
    });
    return out;
  }
  $$('[data-add]').forEach(function(b){ b.addEventListener('click', function(){ addRow(b.dataset.add); onChange(); }); });

  function state(){
    return {
      cond: cond(),
      sku:$('#sku').value.trim(), productId:$('#productId').value.trim(),
      targetPrice:$('#targetPrice').value.trim(), shippingPlan:$('#shippingPlan').value.trim(),
      researchNotes:$('#researchNotes').value.trim(),
      brand:$('#brand').value.trim(), part:$('#part').value.trim(),
      what:$('#what').value.trim(), sold:$('#sold').value.trim(),
      title:$('#headline').value.trim(), hook:$('#hook').value.trim(),
      pdesc:$('#productdesc').value.trim(), mounting:$('#mounting').value.trim(),
      box:readRows('box',false), spec:readRows('spec',true), ver:readRows('ver',false)
    };
  }

  var PROBLEM_WORDS = {
    "headline":"the headline", "part number":"the part number", "hook":"the short pitch (hook)",
    "sold as":"the “sold as” box", "at least one box item":"at least one “in the box” line",
    "at least one verified line":"at least one “what we verified” line"
  };

  function onChange(){
    var s = state();
    var t = CORE.ebayTitle(s);
    $('#titlePreview').value = t;
    var n = t.length, tc = $('#titleCount');
    tc.textContent = n + ' / 80';
    tc.className = 'count ' + (n>80?'over':(n>0?'ok':''));
    var hn = s.hook.length, hc = $('#hookCount');
    hc.textContent = hn + ' letters' + (hn>170?' — a bit long for phones':'');
    hc.className = 'count ' + (hn>170?'over':(hn?'ok':''));

    var probs = CORE.problems(s);
    var banner = $('#readyBanner');
    if(probs.length){
      banner.className = 'banner bad';
      banner.innerHTML = '<b>Not ready yet.</b> Please fill in: ' +
        probs.map(function(p){ return PROBLEM_WORDS[p]||p; }).join(', ') + '.';
    } else if(n>80){
      banner.className = 'banner bad';
      banner.innerHTML = '<b>Title is too long.</b> Take out ' + (n-80) + ' letters so it fits eBay’s 80.';
    } else {
      banner.className = 'banner good';
      banner.innerHTML = '<b>Ready!</b> Go to the last step to copy it into eBay.';
    }
    save();
  }
  $$('#panel-details input, #panel-details textarea').forEach(function(el){
    if(el.id!=='titlePreview') el.addEventListener('input', onChange);
  });
  document.addEventListener('change', function(e){ if(e.target.name==='cond'){ onChange(); drawShots(); } });

  /* =======================================================
     STEP 4 — FINISH  (copy out)
  ======================================================= */
  function copy(text, btn, label){
    function done(){ btn.classList.add('copied'); var old=btn.dataset.label; btn.querySelector('.lbl').textContent='Copied ✓'; toast(label+' copied'); setTimeout(function(){ btn.classList.remove('copied'); btn.querySelector('.lbl').textContent=old; }, 1800); }
    function fb(){ var ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy'); done();}catch(e){ toast('Copy failed — select and copy by hand'); } document.body.removeChild(ta); }
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(done, fb); } else fb();
  }
  $('#copyTitle').addEventListener('click', function(){
    var s=state(); if(CORE.problems(s).length){ toast('Finish the details first'); go(3); return; }
    copy(CORE.ebayTitle(s), this, 'Title');
  });
  $('#copyDesc').addEventListener('click', function(){
    var s=state(); if(CORE.problems(s).length){ toast('Finish the details first'); go(3); return; }
    copy(CORE.build(s), this, 'Description');
  });

  /* =======================================================
     AUTOSAVE  (survives closing the app)
  ======================================================= */
  function save(){
    try{
      var s = state();
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    }catch(e){}
  }
  function restore(){
    var raw; try{ raw = localStorage.getItem(SAVE_KEY); }catch(e){}
    var s = null; if(raw){ try{ s = JSON.parse(raw); }catch(e){} }
    // seed rows
    ['box','spec','ver'].forEach(function(k){ $('#'+k+'Rows').innerHTML=''; });
    if(s){
      var hasSavedProduct=!!(s.sku||s.productId||s.brand||s.part||s.what||s.title||s.pdesc);
      var r = hasSavedProduct ? document.querySelector('input[name=cond][value="'+s.cond+'"]') : null; if(r) r.checked=true;
      if(!hasSavedProduct) document.querySelectorAll('input[name=cond]').forEach(function(x){ x.checked=false; });
      $('#sku').value=s.sku||''; $('#productId').value=s.productId||'';
      $('#targetPrice').value=s.targetPrice||''; $('#shippingPlan').value=s.shippingPlan||'';
      $('#researchNotes').value=s.researchNotes||'';
      $('#brand').value=s.brand||''; $('#part').value=s.part||''; $('#what').value=s.what||'';
      $('#sold').value=s.sold||''; $('#headline').value=s.title||''; $('#hook').value=s.hook||'';
      $('#productdesc').value=s.pdesc||''; $('#mounting').value=s.mounting||'';
      (s.box&&s.box.length?s.box:['','']).forEach(function(t){ addRow('box',t); });
      (s.spec&&s.spec.length?s.spec:SEED_SPEC).forEach(function(p){ addRow('spec',p[0],p[1]); });
      (s.ver&&s.ver.length?s.ver:['','']).forEach(function(t){ addRow('ver',t); });
    } else {
      ['',''].forEach(function(t){ addRow('box',t); });
      SEED_SPEC.forEach(function(p){ addRow('spec',p[0],p[1]); });
      ['',''].forEach(function(t){ addRow('ver',t); });
    }
    onChange();
  }
  function startOver(){
    if(!confirm('Start a fresh item? This clears the photos and the details.')) return;
    try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
    photos=[]; drawShots();
    ['sku','productId','targetPrice','shippingPlan','researchNotes','brand','part','what','sold','headline','hook','productdesc','mounting'].forEach(function(k){ $('#'+k).value=''; });
    document.querySelectorAll('input[name=cond]').forEach(function(r){ r.checked=false; });
    ['box','spec','ver'].forEach(function(k){ $('#'+k+'Rows').innerHTML=''; });
    ['',''].forEach(function(t){ addRow('box',t); });
    SEED_SPEC.forEach(function(p){ addRow('spec',p[0],p[1]); });
    ['',''].forEach(function(t){ addRow('ver',t); });
    onChange(); go(1);
  }
  $('#startOver').addEventListener('click', startOver);

  /* ---------- toast ---------- */
  var toEl;
  function toast(m){ if(!toEl){ toEl=document.createElement('div'); toEl.className='toast'; document.body.appendChild(toEl); } toEl.textContent=m; toEl.classList.add('show'); clearTimeout(toEl._t); toEl._t=setTimeout(function(){ toEl.classList.remove('show'); },1900); }

  /* ---------- boot ---------- */
  restore();
  drawShots();

  function loadPreparedItem(s){
    s=s||{};
    ['sku','productId','targetPrice','shippingPlan','researchNotes','brand','part','what','sold','mounting','hook'].forEach(function(k){
      if($('#'+k)) $('#'+k).value=s[k]||'';
    });
    $('#headline').value=s.title||s.headline||'';
    $('#productdesc').value=s.pdesc||s.productdesc||'';
    document.querySelectorAll('input[name=cond]').forEach(function(r){ r.checked=false; });
    ['box','spec','ver'].forEach(function(k){ $('#'+k+'Rows').innerHTML=''; });
    (s.box&&s.box.length?s.box:['']).forEach(function(v){ addRow('box',v); });
    (s.spec&&s.spec.length?s.spec:SEED_SPEC).forEach(function(v){ addRow('spec',v[0],v[1]); });
    (s.ver&&s.ver.length?s.ver:['']).forEach(function(v){ addRow('ver',v); });
    onChange(); drawShots(); go(1);
  }
  document.addEventListener('ech:loadPrepared', function(e){ loadPreparedItem(e.detail||{}); });
  window.ECHStudio = {
    getState: state,
    loadPrepared: loadPreparedItem,
    buildTitle: function(){ return CORE.ebayTitle(state()); },
    buildHtml: function(){ return CORE.build(state()); },
    problems: function(){ return CORE.problems(state()); }
  };
  go(1);

  if('serviceWorker' in navigator){
    window.addEventListener('load', function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); });
  }
})();
