import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createSystem,digest} from './system.mjs';
const s=await createSystem();const checks=[];
function ok(name){checks.push({name,status:'VERIFIED'});console.log('PASS '+name);}
try{
 const job=await s.seed({sku:'QA-OLD-DRAFT-UPGRADE'}),token=digest(job.token);
 const legacy=(time,text,photos=[])=>({updatedAt:time,item:{...job.item,pdesc:text},photos});
 // Preserve an actual old-schema draft before installing candidate SQL.
 const original=legacy('2026-11-02T10:00:00Z','Keep this correction');
 await s.rpc('ech_draft_state_v24',{p_token_hash:token,p_snapshot:original});
 await s.db.exec(await fs.readFile(new URL('../../server/audit-proposals/draft-revision.sql',import.meta.url),'utf8'));
 const write=p_snapshot=>s.rpc('ech_draft_state_v24',{p_token_hash:token,p_snapshot});
 let saved=await write(legacy('2026-11-02T10:01:00Z','Legacy tab adds a fact'));
 assert.equal(saved._revision,1);
 saved=await write(legacy('2026-11-02T10:02:00Z','Legacy tab saves again'));
 assert.equal(saved._revision,2);ok('Installed rc17 continues ordinary saves through backend-first upgrade');
 await assert.rejects(write(original),/revision conflict/);
 assert.equal((await write(null)).item.pdesc,'Legacy tab saves again');ok('Delayed legacy request cannot erase newer work');
 const mutation={...legacy('2026-11-02T10:03:00Z','Modern app recovers the same job'),_baseRevision:2,_mutationId:randomUUID()};
 saved=await write(mutation);assert.equal(saved._revision,3);assert.equal(saved._protocol,2);
 const replay=await write(mutation);assert.deepEqual(replay,saved);ok('Lost save reply replays exact mutation without another revision');
 await assert.rejects(write({...mutation,item:{...mutation.item,pdesc:'Changed but reused mutation'}}),/mutation identity/);
 ok('Mutation identifier cannot be reused to disguise changed facts');
 await assert.rejects(write(legacy('2026-11-02T10:04:00Z','Old tab tries after modern takeover')),/revision conflict/);
 ok('Old concurrent tab cannot overwrite upgraded client');
 const versions=(await s.db.query('select revision,snapshot from private.ech_photo_draft_versions_v29 where queue_id=$1 order by revision',[job.id])).rows;
 assert.deepEqual(versions.map(v=>v.revision),[0,1,2,3]);assert.equal(versions[0].snapshot.item.pdesc,original.item.pdesc);
 await assert.rejects(s.db.query('update private.ech_photo_draft_versions_v29 set snapshot=$1 where queue_id=$2',[{},job.id]),/immutable/);
 await assert.rejects(s.db.query('delete from private.ech_photo_draft_versions_v29 where queue_id=$1',[job.id]),/immutable/);
 ok('Pre-upgrade draft and every accepted revision retained immutably');
 const grants=(await s.db.query("select has_table_privilege('anon','private.ech_photo_draft_versions_v29','select') a,has_table_privilege('authenticated','private.ech_photo_draft_versions_v29','select') u")).rows[0];assert.equal(grants.a,false);assert.equal(grants.u,false);
 ok('Draft history is private with no public/authenticated direct access');
}finally{await s.close();await fs.mkdir(new URL('../runtime-evidence/',import.meta.url),{recursive:true});await fs.writeFile(new URL('../runtime-evidence/draft-upgrade.json',import.meta.url),JSON.stringify(checks,null,2));}
