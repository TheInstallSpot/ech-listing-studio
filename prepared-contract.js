(function(root){
  'use strict';
  var MANAGED=['sku','productId','brand','part','what','sold','title','availableQuantity','fulfillment',
    'isPassive','compatibilityNote','catalogNote','ebayCategoryId','ebayCategoryName','ebayCategoryPath',
    'ebayCategoryVerifiedAt','box','spec','queueLabel','reviewToken',
    '_queueId','_recommendationId','_approvedAt','_preparationRevision'];
  function unit(label){
    var value=String(label||'').trim();
    if(/^Each$/i.test(value))return 'each';
    if(/^Pair of 2$/i.test(value))return 'pair';
    if(/^Set of [1-9]\d*$/i.test(value))return 'kit';
    if(/^[1-9]\d*-Pack$/i.test(value))return 'carton';
    return null;
  }
  function validText(value){return typeof value==='string'&&!!value.trim();}
  function validate(item,core,authorization){
    var errors=[],it=item||{};
    if(it._preparationError)errors.push('sale-unit approval');
    ['sku','productId','brand','part','what','title'].forEach(function(key){if(!validText(it[key]))errors.push(key);});
    var saleUnit=unit(it.sold);
    if(!saleUnit)errors.push('sale unit');
    var quantity=String(it.availableQuantity==null?'':it.availableQuantity);
    if(!/^[1-9]\d*$/.test(quantity)||!Number.isSafeInteger(Number(quantity)))errors.push('available quantity');
    if(!/^(ech|distributor|pickup)$/.test(String(it.fulfillment||'')))errors.push('fulfillment');
    ['box','ver'].forEach(function(key){if(!Array.isArray(it[key])||!it[key].length||it[key].some(function(v){return !validText(v);}))errors.push(key==='box'?'included contents':'verified item details');});
    if(it.spec!==undefined&&(!Array.isArray(it.spec)||it.spec.some(function(row){return !Array.isArray(row)||row.length!==2||row.some(function(v){return typeof v!=='string';});})))errors.push('technical details');
    if(/speaker/i.test([it.what,it.title].join(' '))&&![true,false,'true','false'].includes(it.isPassive))errors.push('speaker type');
    if(!core||typeof core.ebayTitle!=='function')errors.push('title validator');
    else if([['N1','new_in_box'],['N1','open_box'],['O2','other'],['D3','other']].some(function(v){return core.ebayTitle(Object.assign({},it,{cond:v[0],packaging:v[1]})).length>80;}))errors.push('title length');
    // Private authorization is checked only where it is legitimately available.
    // This object must never be sent to the physical photo client.
    if(authorization){
      if(!['each','pair','kit','carton'].includes(String(authorization.saleUnit||''))||authorization.saleUnit!==saleUnit)errors.push('approved sale unit');
      if(authorization.saleUnitLabel!==it.sold)errors.push('approved sale-unit label');
      ['sku','brand','part','productId','fulfillment'].forEach(function(key){if(authorization[key]!==undefined&&String(authorization[key])!==String(it[key]||''))errors.push('approved '+key);});
      if(String(authorization.availableQuantity)!==quantity)errors.push('approved quantity');
    }
    return {allowed:!errors.length,errors:errors,saleUnit:saleUnit};
  }
  function jobId(item){return item&&(item._draftId||item._queueId||item.queueId)||'';}
  function reconcile(saved,prepared){
    if(!saved||!prepared)return saved;
    var savedId=jobId(saved),preparedId=jobId(prepared);
    // SKU similarity is not proof that two photo jobs are the same physical item.
    if(!savedId||!preparedId||savedId!==preparedId)throw new Error('Prepared corrections belong to a different physical job. Your current photos are preserved.');
    if(saved.sku&&prepared.sku&&saved.sku!==prepared.sku)throw new Error('Prepared corrections do not match this physical item. Your current photos are preserved.');
    var result=Object.assign({},saved);
    MANAGED.forEach(function(key){if(Object.prototype.hasOwnProperty.call(prepared,key))result[key]=prepared[key];});
    // Inspection, condition, packaging, serials, defects and photo-slot state stay
    // with the physical draft. Reconfirmation is needed only if counted contents
    // or sale unit changed, never because somebody refreshed the work list.
    if(['sold','availableQuantity','box'].some(function(key){return Object.prototype.hasOwnProperty.call(prepared,key)&&JSON.stringify(saved[key])!==JSON.stringify(prepared[key]);}))result.quantityConfirmed=false;
    result._draftId=savedId;
    return result;
  }
  var api={validate:validate,reconcile:reconcile,saleUnit:unit};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.ECHPreparedContract=api;
})(typeof window!=='undefined'?window:null);
