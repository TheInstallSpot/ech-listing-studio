/* Local originals and in-progress facts. No credentials, network, publication or inventory writes. */
(function(root){
  'use strict';
  var opened;
  function open(){
    if(!root.indexedDB)return Promise.reject(new Error('This browser cannot save local photo originals.'));
    if(!opened)opened=new Promise(function(resolve,reject){
      var req=root.indexedDB.open('ech-photo-originals-v1',2);
      req.onupgradeneeded=function(){var db=req.result;if(!db.objectStoreNames.contains('drafts'))db.createObjectStore('drafts',{keyPath:'id'});if(!db.objectStoreNames.contains('originals'))db.createObjectStore('originals',{keyPath:'id'});};
      req.onsuccess=function(){var db=req.result;db.onversionchange=function(){db.close();opened=null;};resolve(db);};
      req.onerror=function(){opened=null;reject(req.error||new Error('Local storage unavailable.'));};
      req.onblocked=function(){opened=null;reject(new Error('Close another old Studio tab before saving.'));};
    });
    return opened;
  }
  async function write(record){
    if(!record||!record.id||!record.item||!Array.isArray(record.photos))throw new Error('Invalid local draft.');
    var safe=Object.assign({},record,{item:Object.assign({},record.item)});delete safe.item.reviewToken;
    var originals=await Promise.all(safe.photos.map(async function(photo){var bytes=await photo.original.arrayBuffer(),digest=await root.crypto.subtle.digest('SHA-256',bytes),sha=Array.from(new Uint8Array(digest)).map(function(n){return n.toString(16).padStart(2,'0');}).join('');return {id:safe.id+':'+sha,itemId:safe.id,sha256:sha,name:photo.name,original:photo.original,originalAvailable:photo.originalAvailable};}));
    var db=await open();return new Promise(function(resolve,reject){
      var tx=db.transaction(['drafts','originals'],'readwrite');tx.objectStore('drafts').put(safe);originals.forEach(function(photo){tx.objectStore('originals').put(photo);});
      tx.oncomplete=function(){resolve(safe.id);};tx.onerror=tx.onabort=function(){reject(tx.error||new Error('Photos not confirmed saved locally.'));};
    });
  }
  async function read(id){var db=await open();return new Promise(function(resolve,reject){
    var tx=db.transaction('drafts','readonly'),req=tx.objectStore('drafts').get(id);
    req.onsuccess=function(){resolve(req.result||null);};req.onerror=function(){reject(req.error);};
  });}
  async function count(){var db=await open();return new Promise(function(resolve,reject){var q=db.transaction('drafts','readonly').objectStore('drafts').count();q.onsuccess=function(){resolve(q.result);};q.onerror=function(){reject(q.error);};});}
  async function readOriginals(id){var db=await open();return new Promise(function(resolve,reject){var q=db.transaction('originals','readonly').objectStore('originals').getAll();q.onsuccess=function(){resolve(q.result.filter(function(p){return p.itemId===id;}));};q.onerror=function(){reject(q.error);};});}
  root.ECHDraftStore={write:write,read:read,count:count,readOriginals:readOriginals};
})(window);
