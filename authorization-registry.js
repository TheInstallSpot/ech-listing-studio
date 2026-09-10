(function(){
  'use strict';
  function norm(value){ return String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,''); }
  var restrictedBrands={
    AUDIOQUEST:{label:'AudioQuest',approvedSkus:['AUDI-PHOTON48'],note:'ECH approval is required for each exact AudioQuest SKU.'},
    SONYES:{label:'Sony ES',approvedSkus:[],note:'ECH is not authorized to sell Sony ES on eBay.'}
  };
  function check(item){
    var brand=norm(item&&item.brand), sku=norm(item&&item.sku), part=norm(item&&item.part);
    if(brand==='SONANCE' && (sku.indexOf('MAG')!==-1 || part.indexOf('MAG')!==-1)) return {allowed:false,restricted:true,reason:'This Sonance MAG product is not approved for the normal wholesale queue.',note:'MAG kits are Best Buy exclusives.'};
    var rule=restrictedBrands[brand];
    if(!rule) return {allowed:true,restricted:false,reason:''};
    var allowed=rule.approvedSkus.some(function(approved){return norm(approved)===sku;});
    return {allowed:allowed,restricted:true,reason:allowed?'Approved exact SKU.':rule.label+' is restricted. Exact SKU approval is not registered.',note:rule.note};
  }
  window.ECHAuthorization={check:check,restrictedBrands:restrictedBrands};
})();
