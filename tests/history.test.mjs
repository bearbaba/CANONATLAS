import test from 'node:test';
import assert from 'node:assert/strict';
import {readTxHistory,upsertTxHistory,migrateLegacyTx,historyKey,legacyTxKey} from '../web/history.js';
const contract='0x7Ce8aD067679a76a43b3C8f6d64F10A6D8f02eA0';
const hash='0xa264c8d59d4ed77d351d531a828eb5b798affd21fd5d69ade57904cc103f1cf7';
function store(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),
 removeItem:k=>data.delete(k),raw:data}}
test('old failed screenshot transaction migrates into browser history and is no longer a sticky banner',()=>{
 const local=store(),session=store();
 session.setItem(legacyTxKey(contract),JSON.stringify({hash,method:'assess_entry',stage:'failed',
  detail:'FINALIZED · unsuccessful execution or consensus: FINISHED_WITH_ERROR / MAJORITY_DISAGREE'}));
 const history=migrateLegacyTx(local,session,contract);
 assert.equal(history.length,1);
 assert.equal(history[0].hash,hash);
 assert.equal(history[0].method,'assess_entry');
 assert.equal(history[0].stage,'failed');
 assert.equal(session.getItem(legacyTxKey(contract)),null);
 assert.equal(migrateLegacyTx(local,session,contract).length,1,'migration is idempotent');
});
test('same hash changes status in one history row and preserves original saved time',()=>{
 const db=store();
 const submitted=upsertTxHistory(db,contract,{hash,method:'assess_entry',stage:'submitted',detail:'Waiting'});
 const final=upsertTxHistory(db,contract,{hash,method:'assess_entry',stage:'failed',detail:'FINALIZED unsuccessful'});
 assert.equal(final.length,1);
 assert.equal(final[0].stage,'failed');
 assert.equal(final[0].savedAt,submitted[0].savedAt);
 assert.equal(JSON.parse(db.getItem(historyKey(contract))).length,1);
});
test('rejects malformed hashes, methods and contract identifiers; separate contracts are isolated',()=>{
 const db=store(),other='0x'+'b'.repeat(40);
 upsertTxHistory(db,contract,{hash:'0xNOTVALID',method:'assess_entry',stage:'failed'});
 upsertTxHistory(db,contract,{hash,method:'fake_action',stage:'failed'});
 assert.equal(readTxHistory(db,contract).length,0);
 upsertTxHistory(db,contract,{hash,method:'assess_entry',stage:'failed'});
 assert.equal(readTxHistory(db,other).length,0);
 assert.equal(readTxHistory(db,contract).length,1);
});
test('history does not crash on corrupted browser storage or unavailable storage',()=>{
 const db=store();db.setItem(historyKey(contract),'{');
 assert.deepEqual(readTxHistory(db,contract),[]);
 assert.deepEqual(readTxHistory({getItem(){throw Error('blocked')}},contract),[]);
});
