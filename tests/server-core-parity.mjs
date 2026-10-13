import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';import {stripTypeScriptTypes,createRequire} from 'node:module';
const client=createRequire(import.meta.url)('../builder-core.js');const source=(await fs.readFile(new URL('../server/shared/listing-core.ts',import.meta.url),'utf8')).replace(/^export .*$/gm,'');const ctx={};vm.createContext(ctx);new vm.Script(stripTypeScriptTypes(source,{mode:'strip'})).runInContext(ctx);
let count=0;for(const cond of ['N1','O2','D3'])for(const fulfillment of ['ech','distributor','pickup'])for(const isPassive of [true,false,'true','false']){
 const item={cond,fulfillment,isPassive,brand:'Fixture',part:'EXACT-1',what:'6.5-inch Speaker',title:'Exact & <verified> speaker',sold:'Pair of 2',box:['Two speakers','Grilles'],spec:[['Impedance','8 ohms']],ver:['Label checked'],packaging:'open_box',defects:'Missing remote',compatibilityNote:'Verified fit',shippingPlan:'Reviewed shipment',pdesc:'Verified facts',hook:'Exact variant',mounting:'In ceiling'};
 assert.equal(ctx.build(item),client.build(item));assert.equal(ctx.ebayTitle(item),client.ebayTitle(item));count++;
}
assert.ok(!ctx.build({cond:'N1',fulfillment:'ech',title:{invalid:'object'},box:[{bad:'object'}],ver:[],spec:[[{bad:'key'},'x']]}).includes('[object Object]'));
console.log(count+' valid-input client/server HTML and title parity cases pass; malformed objects do not become buyer facts.');
