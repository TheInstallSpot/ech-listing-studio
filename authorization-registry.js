(function(){
  'use strict';
  function norm(value){ return String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,''); }
  var restrictedBrands={
    AUDIOQUEST:{label:'AudioQuest',approvedSkus:['AUDI-PHOTON48','AUDI-PQ303-BSTOCK','AUDI-PQ303-DEMO'],note:'ECH approval is required for each exact AudioQuest SKU. The PowerQuest approvals apply only to the two sealed B-stock units and one dealer-demo unit in Lee\'s approved warehouse batch.'},
    SONYES:{label:'Sony ES',approvedSkus:[],note:'ECH is not authorized to sell Sony ES on eBay.'}
  };
  var ownerKefIntake={
    'INT26-KEF-T301C':'T301C',
    'INT26-KEF-CI200QL-GRILLE-WH':'CI200QLGRILLE',
    'INT26-KEF-RIF200R':'RIF200R',
    'INT26-KEF-Q6-META-GRILLE':'Q6METAGRILLE',
    'INT26-KEF-CI200QR-GRILLE-WH':'CI200QRGRILLE'
  };
  function ownerKefException(item){
    var sku=String(item&&item.sku||'');
    return norm(item&&item.brand)==='KEF' && ownerKefIntake[sku]===norm(item&&item.part) && String(item&&item.fulfillment||'').toLowerCase()==='ech';
  }
  function check(item){
    var brand=norm(item&&item.brand), sku=norm(item&&item.sku), part=norm(item&&item.part);
    // Current owner holds apply to all conditions and fulfillment paths.
    // These are not lifted by supplier availability or a generic approval flag.
    var exactKefException=ownerKefException(item);
    var heldBrand=(brand==='KEF'&&!exactKefException)||brand==='FOCAL'||brand==='DEFINITIVETECHNOLOGY';
    var heldSku=/^(KEF|FOCAL|DEFINITIVE[ _-]*TECHNOLOGY)[-_]/i.test(String(item&&item.sku||''));
    if(heldBrand||(heldSku&&!exactKefException))return {allowed:false,restricted:true,reason:'This product is on Lee\'s current ECH listing hold.',note:'Lee must explicitly lift the exact hold before this product can enter the listing workflow.'};
    if(brand==='SONANCE' && (sku.indexOf('MAG')!==-1 || part.indexOf('MAG')!==-1)) return {allowed:false,restricted:true,reason:'This Sonance MAG product is not approved for the normal wholesale queue.',note:'MAG kits are Best Buy exclusives.'};
    if(brand==='SONY'&&(/ES$/.test(part)||/(^|[-_])ES($|[-_])/i.test(String(item&&item.sku||''))))return {allowed:false,restricted:true,reason:'Sony ES products are not approved for eBay.'};
    if((brand==='EPISODE'||brand==='TRIAD')&&String(item&&item.fulfillment||'').toLowerCase()==='distributor')return {allowed:false,restricted:true,reason:'This wholesale channel requires an exact reviewed exception.'};
    if(brand==='AUDIOQUEST'&&/^AUDIPQ303/.test(sku)&&String(item&&item.fulfillment||'').toLowerCase()!=='ech')return {allowed:false,restricted:true,reason:'PowerQuest 303 approval is for the specified owned stock only.'};
    var rule=restrictedBrands[brand];
    if(!rule) return {allowed:true,restricted:false,reason:''};
    var allowed=rule.approvedSkus.some(function(approved){return norm(approved)===sku;});
    return {allowed:allowed,restricted:true,reason:allowed?'Approved exact SKU.':rule.label+' is restricted. Exact SKU approval is not registered.',note:rule.note};
  }
  window.ECHAuthorization={check:check,restrictedBrands:restrictedBrands};
})();
