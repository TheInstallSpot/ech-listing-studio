import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const core=createRequire(import.meta.url)('../builder-core.js');
const rows=[['Episode','ES-ESS-BRKT-IWLCR-6','In-Wall LCR Speaker Brackets','Pair of 2'],['Deco TV Frames','FRM-SF-D5182-65-2021','Black Decorative TV Frame','Each'],['Deco TV Frames','FRM-SF-D5182-85-2021','Black Decorative TV Frame','Each']];
for(const [brand,part,what,sold] of rows)for(const [cond,packaging,phrase] of [['N1','','New'],['N1','open_box','New Open Box'],['O2','','Used'],['D3','','Dealer Demo']]){const input={brand,part,what,sold,cond,packaging};const t=core.ebayTitle(input);assert.ok(t.length<=80,t);assert.ok(t.includes(part));assert.ok(t.includes(phrase));assert.ok(t.endsWith(`${sold} (${cond})`));assert.equal(input.what,what);console.log(t.length,t);}
assert.ok(core.ebayTitle({brand:'Unknown',part:'EXACT-MODEL',what:'Very long '.repeat(20),sold:'Each',cond:'N1'}).length>80,'Unknown products must still require a reviewed descriptor, not silently truncate facts');
console.log('PASS 12 prepared title variants; exact models/condition/unit preserved, old drafts supported');
