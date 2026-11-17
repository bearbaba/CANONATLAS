/** CANONATLAS transaction history: local, contract-scoped, no wallet or RPC side effects.
 * It records what the UI observed, not an independent full-chain transaction index. */
const isHash=x=>typeof x==='string'&&/^0x[a-fA-F0-9]{64}$/.test(x);
const isAddress=x=>typeof x==='string'&&/^0x[a-fA-F0-9]{40}$/.test(x);
const methods=new Set(['create_world','propose_entry','assess_entry','ratify_entry','decline_entry']);
const stages=new Set(['submitted','consensus','readback','unverified','success','failed','undetermined']);
const MAX_HISTORY=60;
export const historyKey=contract=>'canonatlas_tx_history_v1_'+String(contract||'').toLowerCase();
export const legacyTxKey=contract=>'canonatlas_last_verified_tx_'+String(contract||'').toLowerCase();
function parseRecord(x){
 if(!x||typeof x!=='object'||!isHash(x.hash)||!methods.has(x.method)||!stages.has(x.stage))return null;
 const detail=typeof x.detail==='string'?x.detail.slice(0,500):'';
 const savedAt=Number.isSafeInteger(x.savedAt)&&x.savedAt>0?x.savedAt:Date.now();
 return {hash:x.hash.toLowerCase(),method:x.method,stage:x.stage,detail,savedAt};
}
export function readTxHistory(storage,contract){
 if(!isAddress(contract)||!storage)return [];
 try{
  const items=JSON.parse(storage.getItem(historyKey(contract))||'[]');
  if(!Array.isArray(items))return [];
  const seen=new Set(),valid=[];
  for(const row of items){
   const v=parseRecord(row);
   if(!v||seen.has(v.hash))continue;
   seen.add(v.hash);valid.push(v);
   if(valid.length>=MAX_HISTORY)break;
  }
  return valid;
 }catch{return []}
}
export function upsertTxHistory(storage,contract,record){
 if(!isAddress(contract)||!storage)return [];
 const row=parseRecord(record);
 if(!row)return readTxHistory(storage,contract);
 const old=readTxHistory(storage,contract);
 const existing=old.find(x=>x.hash===row.hash);
 // Preserve the original save timestamp for successive status transitions.
 if(existing)row.savedAt=existing.savedAt;
 const next=[row,...old.filter(x=>x.hash!==row.hash)].slice(0,MAX_HISTORY);
 try{storage.setItem(historyKey(contract),JSON.stringify(next))}catch{}
 return next;
}
export function migrateLegacyTx(storage,session,contract){
 if(!isAddress(contract))return readTxHistory(storage,contract);
 try{
  const raw=session?.getItem(legacyTxKey(contract));
  if(raw){
   const old=JSON.parse(raw);
   if(old&&['success','failed','undetermined'].includes(old.stage)){
    upsertTxHistory(storage,contract,old);
    session.removeItem?.(legacyTxKey(contract));
   }
  }
 }catch{}
 return readTxHistory(storage,contract);
}
