import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8'),body=app.slice(app.indexOf('  function addFiles('),app.indexOf("  $('#camIn')"));
const archived=[],events=[],order=[];
const c={draftId:'qa-original',photos:[],unreadableOriginals:[],pendingPhotos:[],productGeneration:1,drawShots(){},toast(){},Event,File,Blob,setTimeout,
 window:{ECHDraftStore:{archiveOriginal:async(id,photo)=>{assert.equal(id,'qa-original');archived.push(photo);order.push('archive');}}},
 document:{dispatchEvent:e=>events.push(e.type)},dataUrlToBlob:s=>new Blob([Buffer.from(s.split(',')[1],'base64')]),
 FileReader:class{readAsDataURL(file){if(file.name==='aborted'){this.onabort();return;}this.result='data:image/heic;base64,'+Buffer.from('exact raw original').toString('base64');this.onload();}},
 Image:class{set src(value){order.push('decode');this.onerror();}}
};vm.createContext(c);vm.runInContext(body,c);
c.addFiles([new File(['camera backing not retained'],'unsupported.heic',{type:'image/heic'})]);await c.waitForPhotos();
assert.deepEqual(order,['archive','decode']);assert.equal(c.photos.length,0);assert.equal(c.unreadableOriginals.length,1);
assert.equal(await archived[0].original.text(),'exact raw original');assert.equal(await c.unreadableOriginals[0].original.text(),'exact raw original');assert.ok(events.includes('ech:draftChanged'));
c.addFiles([new File(['x'],'aborted',{type:'image/jpeg'})]);await c.waitForPhotos();assert.equal(c.pendingPhotos.length,0);
console.log('PASS raw capture bytes are owned and archived before decode; failed HEIC decode retains original; aborted reader cannot hang the photo queue');
const summary=app.slice(app.indexOf('  function updatePhotoSummary('),app.indexOf('  function receiptView('));
const status={};const state={received:true,photos:[],$:()=>status};vm.createContext(state);vm.runInContext(summary,state);state.updatePhotoSummary();assert.match(status.textContent,/Sent to Lee/);assert.doesNotMatch(status.textContent,/Add at least/);
console.log('PASS recovered received item never asks Paige to retake missing-on-screen photos');
