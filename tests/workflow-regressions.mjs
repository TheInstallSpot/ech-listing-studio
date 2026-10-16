import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const local=fs.readFileSync(new URL('../draft-local.js',import.meta.url),'utf8');
async function recovery(localDate,cloudDate,submitted=false){
 let restored=0;const el=()=>({style:{},setAttribute(){},after(){},querySelector:el,appendChild(){},textContent:''});
 const studio={getState:()=>({_draftId:'job-A',sku:'TEST'}),restoreLocalDraft:async()=>{restored++;},snapshotDraft:()=>({id:'job-A',item:{sku:'TEST'},photos:[]})};
 const cx={window:{ECHStudio:studio,ECHDraftStore:{read:async()=>({id:'job-A',updatedAt:localDate,item:{sku:'TEST'},photos:[]}),readOriginals:async()=>[],write:async()=>{}},ECHCloud:{ready:async()=>{},isSubmitted:()=>submitted,recoveredDraft:()=>({id:'job-A',updatedAt:cloudDate})}},document:{createElement:el,getElementById:el,addEventListener(){}},URL,setTimeout,clearTimeout};
 vm.runInNewContext(local,cx);await cx.window.ECHDrafts.ready();await cx.window.ECHDrafts.flush();return restored;
}
assert.equal(await recovery('2026-10-15T10:00:00Z','2026-10-15T11:00:00Z'),0);console.log('PASS newer cloud draft cannot be overwritten by older local originals/facts');
assert.equal(await recovery('2026-10-15T12:00:00Z','2026-10-15T11:00:00Z'),1);console.log('PASS newer unsent device work remains recoverable');
assert.equal(await recovery('2026-10-15T10:00:00Z',''),1);console.log('PASS legacy snapshots without timestamps retain local recovery');
assert.equal(await recovery('2026-10-15T12:00:00Z','2026-10-15T11:00:00Z',true),0);console.log('PASS submitted receipt prevents stale local draft from reopening a completed job');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');const body=app.slice(app.indexOf('  function addFiles('),app.indexOf("  $('#camIn')"));
const cx={photos:[],pendingPhotos:[],productGeneration:1,drawShots(){},toast(){},Event,document:{dispatchEvent(){}},FileReader:class{readAsDataURL(f){setTimeout(()=>{this.result=f.name;this.onload();},0);}},Image:class{set src(v){setTimeout(()=>this.onload(),v==='first.png'?20:0);}},setTimeout,Promise};
vm.createContext(cx);vm.runInContext(body,cx);cx.addFiles([{type:'image/png',name:'first.png'},{type:'image/png',name:'second.png'}]);assert.equal(cx.photos.length,0);await cx.waitForPhotos();assert.deepEqual(Array.from(cx.photos,p=>p.name),['first.png','second.png']);console.log('PASS pending camera/file decoding is awaited and selected photo order is preserved');
const queue=fs.readFileSync(new URL('../agent-queue.js',import.meta.url),'utf8');const save=queue.slice(queue.indexOf('  function saveLocal('),queue.indexOf('  function handoffMessage('));const cache={localStorage:{getItem:()=>null,setItem(){throw Error('Quota exceeded');}},REVIEW_KEY:'test'};vm.createContext(cache);vm.runInContext(save,cache);assert.equal(cache.saveLocal({item:{sku:'TEST'}}),false);console.log('PASS failed legacy text-cache write is reported without aborting independent cloud submission');
console.log('6 current-workflow regression checks passed.');
