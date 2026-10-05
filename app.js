/* ECH Listing Studio — clean-photo and listing-review workflow, iPad-first PWA. */
(function(){
  "use strict";
  var $ = function(s,r){ return (r||document).querySelector(s); };
  var $$ = function(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };
  var CORE = window.ECHCore;
  var SAVE_KEY = "ech-studio-v1";
  var MAX_PHOTO_SIDE = 2000;
  var MIN_RECOMMENDED_SIDE = 1600;

  /* ---------- shared state ---------- */
  var step = 1;
  var photos = []; // {name, img}
  var productGeneration=0;

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
    var activePanel = $('.panel.active');
    if(activePanel) activePanel.scrollIntoView({block:'start', behavior:'smooth'});
  }
  $('#navBack').addEventListener('click', function(){ go(step-1); });
  $('#navNext').addEventListener('click', function(){
    if(step === 4){ startOver(); return; }
    if(step === 1 && !cond()){ toast('Choose the condition before going on'); return; }
    go(step+1);
  });
  $$('.rail .st').forEach(function(s){ s.addEventListener('click', function(){ var target=+s.dataset.step; if(step===1 && target>1 && !cond()){ toast('Choose the condition before going on'); return; } go(target); }); });

  /* =======================================================
     STEP 2 — PHOTOS  (clean JPEG normalization)
  ======================================================= */
  function safeNamePiece(value){
    return String(value||'ECH-item').trim().replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'') || 'ECH-item';
  }

  function photoName(index){
    var sku = ($('#sku') && $('#sku').value) || ($('#part') && $('#part').value) || 'ECH-item';
    return safeNamePiece(sku) + '-' + String(index+1).padStart(2,'0') + (index===0?'-main':'') + '.jpeg';
  }

  function normalizePhoto(f){ // returns a plain RGB JPEG with no added text or artwork
    var sourceW=f.img.naturalWidth, sourceH=f.img.naturalHeight;
    var longest=Math.max(sourceW,sourceH);
    var scale=longest>MAX_PHOTO_SIDE?MAX_PHOTO_SIDE/longest:1;
    var cv = document.createElement('canvas');
    cv.width = Math.max(1,Math.round(sourceW*scale));
    cv.height = Math.max(1,Math.round(sourceH*scale));
    var g = cv.getContext('2d');
    g.fillStyle='#ffffff';
    g.fillRect(0,0,cv.width,cv.height);
    g.drawImage(f.img,0,0,cv.width,cv.height);
    return {
      dataUrl:cv.toDataURL('image/jpeg',0.93),
      w:cv.width,
      h:cv.height,
      small:Math.max(cv.width,cv.height)<MIN_RECOMMENDED_SIDE
    };
  }

  function dataUrlToBlob(dataUrl){
    var parts=dataUrl.split(','), match=/data:([^;]+)/.exec(parts[0]);
    var bytes=atob(parts[1]), out=new Uint8Array(bytes.length);
    for(var i=0;i<bytes.length;i++) out[i]=bytes.charCodeAt(i);
    return new Blob([out],{type:match?match[1]:'image/jpeg'});
  }

  function updatePhotoSummary(){
    var el=$('#photoSummary');
    if(!photos.length){ el.className='photo-summary'; el.textContent='Add at least one exact-product photo.'; return; }
    var small=photos.reduce(function(n,f){return n+(normalizePhoto(f).small?1:0);},0);
    if(small){
      el.className='photo-summary warn-photo';
      el.textContent=photos.length+' photo'+(photos.length===1?'':'s')+' ready, but '+small+' '+(small===1?'is':'are')+' smaller than the recommended 1600 pixels.';
    }else{
      el.className='photo-summary ready-photo';
      el.textContent='Photos ready ✓ Clean JPEGs with no badges or added text.';
    }
  }

  function drawShots(){
    document.dispatchEvent(new Event('ech:draftChanged'));
    var host = $('#shots');
    updatePhotoSummary();
    if(!photos.length){ host.innerHTML = '<div class="empty">No photos yet. Use the buttons above to take or choose photos.</div>'; return; }
    host.innerHTML = "";
    photos.forEach(function(f,index){
      var r=normalizePhoto(f), name=photoName(index);
      var el = document.createElement('div');
      el.className = 'shot';
      el.innerHTML =
        '<img alt="Clean eBay-ready photo" src="'+r.dataUrl+'">'+
        '<div class="meta">'+
          '<p class="fn">'+name+'</p>'+
          '<p class="flag">'+r.w+' × '+r.h+' &middot; '+
            (r.small ? '<span class="bad">usable, but a larger original is better</span>'
                     : '<span class="ok">good size, buyers can zoom</span>')+
          '</p>'+
          '<p class="savehint">'+(index===0?'<b>Main eBay photo</b> · ':'')+'Clean `.jpeg`, ready for upload.</p>'+
          '<div class="photo-card-actions"><button class="remove1" type="button">Remove</button></div>'+
        '</div>';
      el.querySelector('.remove1').addEventListener('click',function(){ photos.splice(index,1); drawShots(); });
      host.appendChild(el);
    });
  }

  function addFiles(list){
    var generation=productGeneration;
    Array.prototype.forEach.call(list, function(file){
      if(!/^image\//.test(file.type)) return;
      var rd = new FileReader();
      rd.onload = function(){
        var im = new Image();
        im.onload = function(){ if(generation!==productGeneration)return;photos.push({name:file.name||('photo-'+(photos.length+1)+'.jpeg'), img:im}); drawShots(); };
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
      availableQuantity:$('#availableQuantity').value.trim(),
      fulfillment:$('#fulfillment').value.trim(), reviewToken:$('#reviewToken').value.trim(),
      isPassive:$('#isPassive').value.trim(), compatibilityNote:$('#compatibilityNote').value.trim(),
      catalogNote:$('#catalogNote').value.trim(),
      ebayCategoryId:$('#ebayCategoryId').value.trim(),
      ebayCategoryName:$('#ebayCategoryName').value.trim(),
      ebayCategoryPath:$('#ebayCategoryPath').value.trim(),
      ebayCategoryVerifiedAt:$('#ebayCategoryVerifiedAt').value.trim(),
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
    "valid sale unit":"the sale unit as Each, Pair of 2, Set of N, or N-Pack",
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
      banner.innerHTML = '<b>Ready!</b> Go to the last step and send it to Lee.';
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

  function reviewIssues(){
    var s=state(), issues=[];
    if(!s.cond) issues.push('Choose N1, O2, or D3 from the item in front of you.');
    CORE.problems(s).forEach(function(p){ issues.push('Finish '+(PROBLEM_WORDS[p]||p)+'.'); });
    if(CORE.ebayTitle(s).length>80) issues.push('Shorten the title to 80 characters or fewer.');
    if(!photos.length) issues.push('Add at least one exact-product photo.');
    if(!/^\d+$/.test(s.availableQuantity)||+s.availableQuantity<1) issues.push('Ask Lee to add the available quantity in sellable units.');
    if(!/^(distributor|ech|pickup)$/.test(s.fulfillment)) issues.push('Ask Lee to choose distributor, ECH stock, or pickup fulfillment.');
    if(/speaker/i.test([s.what,s.title].join(' '))&&!/^(true|false)$/.test(s.isPassive)) issues.push('Ask Lee to confirm whether this speaker is passive or powered.');
    if(String(window.ECH_REVIEW_ENDPOINT||'').trim()&&!s.reviewToken) issues.push('Ask Lee to reconnect this product to the Business Hub.');
    return issues;
  }

  function reviewText(s,title,manifest){
    var lines=[
      'ECH LISTING REVIEW',
      'Nothing in this review has been published to eBay.',
      '',
      'SKU: '+(s.sku||'Not entered'),
      'Product: '+[s.brand,s.part,s.what].filter(Boolean).join(' '),
      'Condition: '+s.cond,
      'Sale unit: '+s.sold,
      'Title: '+title,
      'Target price: '+(s.targetPrice||'Lee review required'),
      'Shipping: '+(s.shippingPlan||'Lee review required'),
      'Available quantity: '+(s.availableQuantity||'Lee review required'),
      'Fulfillment: '+(s.fulfillment||'Lee review required'),
      'Photos: '+manifest.length,
      '',
      'IN THE BOX',
      s.box.join('\n'),
      '',
      'WHAT WAS VERIFIED',
      s.ver.join('\n'),
      '',
      'RESEARCH NOTES',
      s.researchNotes||'None'
    ];
    return lines.join('\n');
  }

  function prepareReview(){
    var s=state(), issues=reviewIssues(), title=CORE.ebayTitle(s), manifest=[];
    var files=photos.map(function(f,index){
      var r=normalizePhoto(f), name=photoName(index);
      manifest.push({name:name,width:r.w,height:r.h,needsLargerOriginal:r.small});
      return new File([dataUrlToBlob(r.dataUrl)],name,{type:'image/jpeg',lastModified:Date.now()});
    });
    var privateItem=Object.assign({},s);
    delete privateItem.reviewToken;
    var pack={
      schemaVersion:1,
      reviewStatus:'awaiting_lee_approval',
      preparedAt:new Date().toISOString(),
      item:privateItem,
      ebayTitle:title,
      descriptionHtml:(s.cond&&!CORE.problems(s).length)?CORE.build(s):'',
      photoManifest:manifest,
      issues:issues
    };
    return {issues:issues,pack:pack,files:files,reviewText:reviewText(s,title,manifest),reviewToken:s.reviewToken};
  }

  /* =======================================================
     AUTOSAVE  (survives closing the app)
  ======================================================= */
  function save(){
    try{
      var s = state();
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
      document.dispatchEvent(new Event('ech:draftChanged'));
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
      $('#availableQuantity').value=s.availableQuantity||'';
      $('#fulfillment').value=s.fulfillment||''; $('#reviewToken').value=s.reviewToken||'';
      $('#isPassive').value=s.isPassive||''; $('#compatibilityNote').value=s.compatibilityNote||'';
      $('#catalogNote').value=s.catalogNote||'';
      $('#ebayCategoryId').value=s.ebayCategoryId||'';
      $('#ebayCategoryName').value=s.ebayCategoryName||'';
      $('#ebayCategoryPath').value=s.ebayCategoryPath||'';
      $('#ebayCategoryVerifiedAt').value=s.ebayCategoryVerifiedAt||'';
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
  async function startOver(){
    if(window.ECHCloud&&photos.length){try{await window.ECHCloud.flush();}catch(e){toast('Photos are not confirmed saved. Stay here and retry saving.');return;}}
    if(!confirm('Start a fresh item? This clears the photos and the details.')) return;
    productGeneration++;
    try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
    photos=[]; drawShots();
    ['sku','productId','availableQuantity','fulfillment','reviewToken','isPassive','compatibilityNote','catalogNote','ebayCategoryId','ebayCategoryName','ebayCategoryPath','ebayCategoryVerifiedAt','targetPrice','shippingPlan','researchNotes','brand','part','what','sold','headline','hook','productdesc','mounting'].forEach(function(k){ $('#'+k).value=''; });
    document.querySelectorAll('input[name=cond]').forEach(function(r){ r.checked=false; });
    ['box','spec','ver'].forEach(function(k){ $('#'+k+'Rows').innerHTML=''; });
    ['',''].forEach(function(t){ addRow('box',t); });
    SEED_SPEC.forEach(function(p){ addRow('spec',p[0],p[1]); });
    ['',''].forEach(function(t){ addRow('ver',t); });
    if(window.ECHCloud)window.ECHCloud.resetEmpty();
    onChange(); go(1);
  }
  $('#startOver').addEventListener('click', startOver);
  $('#resetWork').addEventListener('click', startOver);

  /* ---------- toast ---------- */
  var toEl;
  function toast(m){ if(!toEl){ toEl=document.createElement('div'); toEl.className='toast'; document.body.appendChild(toEl); } toEl.textContent=m; toEl.classList.add('show'); clearTimeout(toEl._t); toEl._t=setTimeout(function(){ toEl.classList.remove('show'); },1900); }

  /* ---------- boot ---------- */
  restore();
  drawShots();

  function loadPreparedItem(s){
    productGeneration++;
    s=s||{};
    $('#sendToLee').disabled=false;$('#sendToLee').textContent='Send to Lee for approval';
    $('#handoffStatus').textContent='Lee will review this item before publication.';
    if(s.sku && s.sku!==$('#sku').value) photos=[];
    // Only clean incoming preparation, never overwrite an in-progress draft.
    s=Object.assign({},s);
    if(/being (documented|prepared|photographed)|photos must|complete boxes are available/i.test(s.hook||''))s.hook='';
    s.box=(s.box||[]).filter(function(v){return !/^(Paige must|Exact package contents must)/i.test(v);});
    s.ver=(s.ver||[]).filter(function(v){return !/^(Photograph|Make a separate photo|Lay out|Keep the new box|Put (all|both)|Do not open|Use (both|the speaker)|Record any)/i.test(v);});
    if(s.pdesc)s.pdesc=s.pdesc.replace(/ The listing must describe.*$/,'');
    ['sku','productId','targetPrice','shippingPlan','researchNotes','brand','part','what','sold','mounting','hook'].forEach(function(k){
      if($('#'+k)) $('#'+k).value=s[k]||'';
    });
    $('#availableQuantity').value=String(s.availableQuantity!=null?s.availableQuantity:(s.quantity!=null?s.quantity:''));
    $('#fulfillment').value=String(s.fulfillment||'').toLowerCase();
    $('#reviewToken').value=String(s.reviewToken||'');
    $('#isPassive').value=s.isPassive===true?'true':(s.isPassive===false?'false':String(s.isPassive||''));
    $('#compatibilityNote').value=String(s.compatibilityNote||'');
    $('#catalogNote').value=String(s.catalogNote||'');
    $('#ebayCategoryId').value=String(s.ebayCategoryId||'');
    $('#ebayCategoryName').value=String(s.ebayCategoryName||'');
    $('#ebayCategoryPath').value=String(s.ebayCategoryPath||'');
    $('#ebayCategoryVerifiedAt').value=String(s.ebayCategoryVerifiedAt||'');
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
    problems: function(){ return CORE.problems(state()); },
    reviewIssues: reviewIssues,
    prepareReview: prepareReview,
    photoCount: function(){ return photos.length; },
    exportPhotos: function(){return photos.map(function(f,index){var r=normalizePhoto(f);return new File([dataUrlToBlob(r.dataUrl)],photoName(index),{type:'image/jpeg'});});},
    restoreCloud: async function(s,files){
      var generation=productGeneration, current=state();
      if(s.sku!==current.sku||s.reviewToken!==current.reviewToken)throw new Error('Saved product does not match this item.');
      var restored=await Promise.all(files.map(function(file){return new Promise(function(resolve,reject){
        var url=URL.createObjectURL(file),im=new Image();
        im.onload=function(){URL.revokeObjectURL(url);resolve({name:file.name,img:im});};
        im.onerror=function(){URL.revokeObjectURL(url);reject(new Error('Cannot recover photo'));};im.src=url;
      });}));
      if(generation!==productGeneration)return;
      loadPreparedItem(s);
      document.querySelectorAll('input[name=cond]').forEach(function(r){r.checked=r.value===s.cond;});
      photos=restored;onChange();drawShots();go(2);
    }
  };
  go(1);

  if('serviceWorker' in navigator){
    window.addEventListener('load', function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); });
  }
})();
