import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context={window:{}};
vm.runInNewContext(await fs.readFile(new URL('../authorization-registry.js',import.meta.url),'utf8'),context);
const check=item=>context.window.ECHAuthorization.check(item).allowed;
for(const [sku,brand,part] of [['NOV16-KEF-CI200RR-THX','KEF','Ci200RR-THX'],['NOV16-KEF-CI130QRFL','KEF','Ci130QRfl'],['NOV16-FOCAL-300-ICLCR5','Focal','300 ICLCR5']]){
 const item={sku,brand,part,fulfillment:'ech'};
 assert.equal(check(item),true);
 assert.equal(check({...item,fulfillment:'distributor'}),false);
 assert.equal(check({...item,part:'different model'}),false);
 assert.equal(check({...item,sku:'OTHER-'+sku}),false);
 assert.equal(check({...item,brand:brand==='KEF'?'Focal':'KEF'}),false);
}
assert.equal(check({sku:'FOCAL-300-ICW8',brand:'Focal',part:'300 ICW8',fulfillment:'ech'}),false);
console.log('PASS exact owned-stock KEF/Focal intake; wrong SKU, model, brand and distributor remain blocked');
