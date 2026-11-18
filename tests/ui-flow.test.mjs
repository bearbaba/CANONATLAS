import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
import {finalReceipt,combineFinalChecks,normalizePendingTx,reconcileReceiptSnapshots,isUndeterminedFinal} from '../web/tx-status.js';
import {addressValid,validWorld,validEntry,actionGates} from '../web/safety.js';
import {readTxHistory,upsertTxHistory,migrateLegacyTx} from '../web/history.js';

const OWNER='0x'+'a'.repeat(40),AUTHOR='0x'+'b'.repeat(40),HASH='0x'+'f'.repeat(64);
const CONTRACT='0x7Ce8aD067679a76a43b3C8f6d64F10A6D8f02eA0';
const RULES=[
 {id:'CHAR1',kind:'continuity',text:'The keepers remain at the harbor.'},
 {id:'TIME1',kind:'chronology',text:'A storm occurred in year 162.'},
 {id:'LAW1',kind:'world_rules',text:'Mirrors can only contain memories.'}
];
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function element(){return {value:'',textContent:'',innerHTML:'',disabled:false,hidden:true,
 className:'',style:{},classList:{add(){},remove(){},toggle(){}},href:'',title:'',
 handlers:{},children:[],addEventListener(name,fn){this.handlers[name]=fn},
 replaceChildren(...v){this.children=v},append(...v){this.children.push(...v)}}}
function harness({actor=OWNER,entryStatus='CONSISTENT',timeout=false,pendingEntry,entryExists=true,connectError=null,approvalGate=null,undetermined=false,staleSdk=false,disagreed=false,archivedFailed=false}={}){
 const nodes=new Map(),events={},writes=[],storage=new Map();
 let disconnectCount=0;
 if(archivedFailed)upsertTxHistory({getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},CONTRACT,{
  hash:HASH,method:'assess_entry',stage:'failed',
  detail:'FINALIZED · unsuccessful execution or consensus: FINISHED_WITH_ERROR / MAJORITY_DISAGREE'});
 const initial={worldId:'1',entryId:'1',worldTitle:'The Glass Archipelago',
   premise:'A sea-bound world of original imaginary characters.',
   scene:'In year 166, Mira studied a memory mirror while nobody crossed the Quiet Sea.',
   entryTitle:'A memory of the harbor'};
 const $=id=>{if(!nodes.has(id)){const x=element();x.value=initial[id]||'';nodes.set(id,x)}return nodes.get(id)};
 let world={id:1,owner:OWNER,title:'The Lantern Isles',canon_version:1,canon:RULES,
   pending_entry:pendingEntry??1,ratified_entries:[],closed_entries:[],canon_sha256:'a'.repeat(64)};
 let worldsCount=1,entriesCount=1;
 let entry=entryExists?{id:1,world_id:1,author:AUTHOR,title:'The Memory Across the Mist',status:entryStatus,canon_version:1,
   scene:'In year 166, Mira read a mirror memory.',scene_sha256:'b'.repeat(64),
   assessment_runs:entryStatus==='SUBMITTED'?0:1,assessment:{verdict:'CONSISTENT',checks:[
    {criterion:'chronology',result:'PASS',reason:'The time sequence matches frozen canon.',
      references:[{ref_id:'TIME1:1',field:'chronology',quote:'A storm occurred in year 162.'}]}
   ]}}:null;
 let shouldTimeout=timeout;
 const deps={
  connectWallet:async()=>{if(connectError)throw connectError;return actor},
  disconnectWallet:()=>{disconnectCount+=1;},
  subscribeWalletChanges:({onAccountsChanged,onChainChanged})=>{
   events.accountsChanged=onAccountsChanged;events.chainChanged=onChainChanged;return ()=>{};
  },
  read:async(_addr,method)=>method==='stats'?{name:'CANONATLAS',version:'1.0.0',citation_mode:'DETERMINISTIC_REFERENCE_IDS',worlds:worldsCount,entries:entriesCount}:
    method==='get_world'?structuredClone(world):structuredClone(entry),
  write:async(_addr,_signer,method,args)=>{if(approvalGate)await approvalGate;writes.push({method,args});
   if(method==='ratify_entry'){entry={...entry,status:'RATIFIED'};world={...world,canon_version:2,
      pending_entry:0,ratified_entries:[1],canon:[...RULES,{id:'ENTRY_1',kind:'continuity',text:entry.scene}]};}
   else if(method==='assess_entry'&&!undetermined&&!disagreed){entry={...entry,status:'CONSISTENT',assessment_runs:1};}
   else if(method==='create_world'){
    worldsCount+=1;world={...world,id:worldsCount,owner:actor,canon_version:1,
      canon:RULES,pending_entry:0,ratified_entries:[]};
   }else if(method==='propose_entry'){
    entriesCount+=1;entry={...entry,id:entriesCount,world_id:world.id,author:actor,
      status:'SUBMITTED',canon_version:world.canon_version,
      scene:"A new author's original scene.",scene_sha256:'c'.repeat(64),
      assessment_runs:0,assessment:{}};world={...world,pending_entry:entriesCount};
   }
   else if(method==='decline_entry'){entry={...entry,status:'DECLINED'};world={...world,pending_entry:0};}
   return HASH},
  waitForFinalized:async()=>{if(shouldTimeout||staleSdk)throw Error('temporary remote RPC timeout');
    return {statusName:'FINALIZED',resultName:undetermined?'NO_MAJORITY':disagreed?'MAJORITY_DISAGREE':'MAJORITY_AGREE',
      txExecutionResultName:disagreed?'FINISHED_WITH_ERROR':'FINISHED_WITH_RETURN'}},
  getTransactionState:async()=>shouldTimeout||staleSdk?{statusName:'COMMITTING',status:3}:
    {statusName:'FINALIZED',resultName:undetermined?'NO_MAJORITY':disagreed?'MAJORITY_DISAGREE':'MAJORITY_AGREE',
      txExecutionResultName:disagreed?'FINISHED_WITH_ERROR':'FINISHED_WITH_RETURN'},
  getConsensusReceipt:async()=>shouldTimeout&&!staleSdk?{id:HASH,status:3,result:0,txExecutionResult:0}:
    {id:HASH,status:7,result:undetermined?5:disagreed?2:6,txExecutionResult:disagreed?2:1},
  explorer:hash=>'https://explorer-studio.genlayer.com/tx/'+hash
 };
 const code=readFileSync(new URL('../web/main.js',import.meta.url),'utf8')
  .replace(/^import .*;\s*$/gm,'');
 const imports=`const {connectWallet,disconnectWallet,subscribeWalletChanges,read,write,waitForFinalized,getTransactionState,getConsensusReceipt,explorer}=globalThis.deps;
const {finalReceipt,combineFinalChecks,normalizePendingTx,reconcileReceiptSnapshots,isUndeterminedFinal}=globalThis.tx;
const {addressValid,validWorld,validEntry,actionGates}=globalThis.safety;
const {readTxHistory,upsertTxHistory,migrateLegacyTx}=globalThis.historyDeps;`;
 runInNewContext(imports+code,{
  deps,tx:{finalReceipt,combineFinalChecks,normalizePendingTx,reconcileReceiptSnapshots,isUndeterminedFinal},safety:{addressValid,validWorld,validEntry,actionGates},
  historyDeps:{readTxHistory,upsertTxHistory,migrateLegacyTx},
  document:{getElementById:$,createElement:element},window:{ethereum:{on:(key,cb)=>events[key]=cb}},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),
    removeItem:k=>storage.delete(k)},
  crypto:webcrypto,TextEncoder,Number,console
 });
 return {nodes,writes,events,storage,$,get disconnectCount(){return disconnectCount},get world(){return world},get entry(){return entry},
  set timeout(value){shouldTimeout=value},
  async click(id){const handler=$(id).handlers.click;assert.ok(handler,'button '+id+' is not wired');
   await handler();await flush();await flush();await flush()}
 };
}
test('GenLayer success must be FINALIZED, accepted and execution-successful',()=>{
 assert.equal(finalReceipt({statusName:'FINALIZED',resultName:'MAJORITY_AGREE',
   txExecutionResultName:'FINISHED_WITH_RETURN'}).success,true);
 assert.equal(finalReceipt({statusName:'ACCEPTED',resultName:'MAJORITY_AGREE',
   txExecutionResultName:'FINISHED_WITH_RETURN'}).success,false);
 assert.equal(finalReceipt({statusName:'FINALIZED',resultName:'MAJORITY_DISAGREE',
   txExecutionResultName:'FINISHED_WITH_RETURN'}).success,false);
});
test('pending hash is bound to original address, signer and selected IDs',()=>{
 const row={hash:HASH,method:'ratify_entry',contract:CONTRACT,signer:OWNER,worldId:1,entryId:1};
 assert.equal(normalizePendingTx(row,CONTRACT)?.entryId,1);
 assert.equal(normalizePendingTx({...row,signer:''},CONTRACT),null);
 assert.equal(normalizePendingTx({...row,worldId:-1},CONTRACT),null);
 assert.equal(normalizePendingTx({...row,contract:AUTHOR},CONTRACT),null);
 assert.equal(normalizePendingTx({...row,method:'invented'},CONTRACT),null);
});
test('owner ratifies exact assessed entry and reads canonical version 2',async()=>{
 const h=harness();await flush();await h.click('connect');
 assert.equal(h.$('ratify').disabled,false);
 await h.click('ratify');
 assert.deepEqual(h.writes.map(x=>x.method),['ratify_entry']);
 assert.equal(h.$('entryStatus').textContent,'RATIFIED');
 assert.equal(h.$('canonVersion').textContent,'v2');
 assert.equal(h.$('resume').disabled,true);
 assert.match(h.$('log').textContent,/VERIFIED · FINALIZED/);
});
test('author wallet cannot ratify an author-written entry',async()=>{
 const h=harness({actor:AUTHOR});await flush();await h.click('connect');
 assert.equal(h.$('ratify').disabled,true);
});
test('network timeout preserves signed hash and resumes without duplicate signature',async()=>{
 const h=harness({timeout:true});await flush();await h.click('connect');
 await h.click('ratify');
 assert.ok(h.storage.has('canonatlas_pending_'+CONTRACT.toLowerCase()));
 assert.equal(h.writes.length,1);
 assert.equal(h.$('ratify').disabled,true);
 assert.equal(h.$('resume').disabled,false);
 h.timeout=false;await h.click('resume');
 assert.equal(h.writes.length,1);
 assert.ok(!h.storage.has('canonatlas_pending_'+CONTRACT.toLowerCase()));
 assert.equal(h.$('entryStatus').textContent,'RATIFIED');
});
test('evidence inspector displays original frozen quote as inert text',async()=>{
 const h=harness();await flush();
 h.entry.assessment.checks[0].references[0].quote='A frozen timeline <script>unsafe()</script>';
 await h.click('load');
 const cards=h.$('canonEvidence').children;
 assert.equal(cards.length,1);
 const quote=cards[0].children[2].children[1];
 assert.match(quote.textContent,/<script>unsafe\(\)<\/script>/);
 assert.equal(quote.innerHTML,'');
});
test('wallet change immediately disables steward ratification',async()=>{
 const h=harness();await flush();await h.click('connect');
 assert.equal(h.$('ratify').disabled,false);
 h.events.accountsChanged([AUTHOR]);
 assert.equal(h.$('ratify').disabled,true);
});

test('steward creates a new world through signed wallet and finds its actual new world ID',async()=>{
 const h=harness({actor:OWNER});
 await flush();await h.click('connect');
 assert.equal(h.$('create').disabled,false);
 await h.click('create');
 assert.equal(h.writes.length,1);
 assert.equal(h.writes[0].method,'create_world');
 assert.equal(h.$('worldId').value,'2');
 assert.equal(h.$('worldState').textContent,'VERIFIED');
 assert.match(h.$('log').textContent,/WORLD CREATED/);
});
test('independent author proposes a chapter and sees a submitted entry ID',async()=>{
 const h=harness({actor:AUTHOR,pendingEntry:0,entryExists:false});
 await flush();await h.click('connect');
 assert.equal(h.$('propose').disabled,false);
 await h.click('propose');
 assert.equal(h.writes.length,1);
 assert.equal(h.writes[0].method,'propose_entry');
 assert.equal(h.$('entryId').value,'2');
 assert.equal(h.$('entryStatus').textContent,'SUBMITTED');
 assert.match(h.$('log').textContent,/VERIFIED · FINALIZED/);
});
test('only original author can request initial independent AI review of a submitted scene',async()=>{
 const h=harness({actor:AUTHOR,entryStatus:'SUBMITTED'});
 await flush();await h.click('connect');
 assert.equal(h.$('assess').disabled,false);
 await h.click('assess');
 assert.equal(h.writes[0].method,'assess_entry');
 assert.equal(h.$('entryStatus').textContent,'CONSISTENT');
 const owner=harness({actor:OWNER,entryStatus:'SUBMITTED'});
 await flush();await owner.click('connect');
 assert.equal(owner.$('assess').disabled,true);
});

test('wallet failures are visible on Overview without opening the GenLayer console',async()=>{
 const h=harness({connectError:new Error('No browser wallet was detected')});
 await flush();await h.click('connect');
 assert.equal(h.$('walletAlert').hidden,false);
 assert.equal(h.$('walletAlert').className,'wallet-alert is-error');
 assert.match(h.$('walletAlert').textContent,/No browser wallet was detected/);
 assert.equal(h.$('connect').textContent,'Connect wallet ↗');
});
test('successful connect hides the green banner; network changes still show warnings',async()=>{
 const h=harness({actor:OWNER});await flush();await h.click('connect');
 assert.equal(h.$('walletAlert').hidden,true);
 assert.equal(h.$('walletAlert').textContent,'');
 assert.equal(h.$('connect').textContent,'Disconnect');
 assert.equal(h.$('walletIdentity').hidden,false);
 assert.match(h.$('walletIdentity').textContent,/✓/);
 h.events.chainChanged('0x1');
 assert.equal(h.$('ratify').disabled,true);
 assert.equal(h.$('walletIdentity').hidden,true);
 assert.equal(h.$('connect').textContent,'Connect wallet ↗');
 assert.equal(h.$('walletAlert').className,'wallet-alert is-warning');
 assert.equal(h.disconnectCount,1);
});

test('Studio nested receipts require accepted execution and same-hash consensus before claiming success',()=>{
 const studio=finalReceipt({status_name:'FINALIZED',
   consensus_data:{leader_receipt:[{execution_result:'SUCCESS'}]}});
 const rpc=finalReceipt({status:7,result:6,txExecutionResult:1});
 assert.equal(studio.finalized,true);
 assert.equal(studio.execution,'FINISHED_WITH_RETURN');
 assert.equal(studio.success,false,'execution alone is insufficient');
 assert.equal(combineFinalChecks(studio,rpc).success,true);
 assert.throws(()=>combineFinalChecks(finalReceipt({status:7,result:7}),rpc),/Conflicting consensus/);
 assert.equal(finalReceipt({status:7,txExecutionResult:1}).success,false);
});

test('Disconnect clears signer and hides identity without deleting public proof or requesting a new write',async()=>{
 const h=harness({actor:OWNER});await flush();await h.click('connect');
 assert.equal(h.$('ratify').disabled,false);
 assert.equal(h.$('connect').textContent,'Disconnect');
 await h.click('connect');
 assert.equal(h.$('connect').textContent,'Connect wallet ↗');
 assert.equal(h.$('walletIdentity').hidden,true);
 assert.equal(h.$('walletIdentity').textContent,'');
 assert.equal(h.$('walletAlert').hidden,true);
 assert.equal(h.$('ratify').disabled,true);
 assert.equal(h.$('worldState').textContent,'VERIFIED');
 assert.equal(h.$('canonVersion').textContent,'v1');
 assert.equal(h.writes.length,0);
 assert.equal(h.disconnectCount,1);
 await h.click('connect');
 assert.equal(h.$('connect').textContent,'Disconnect');
 assert.equal(h.$('walletIdentity').hidden,false);
 assert.equal(h.$('ratify').disabled,false);
 assert.equal(h.disconnectCount,1);
});

test('wallet approval shows rotating loading immediately, before MetaMask resolves',async()=>{
 let approve;const gate=new Promise(resolve=>{approve=resolve});
 const h=harness({approvalGate:gate});await flush();await h.click('connect');
 const action=h.$('create').handlers.click();
 await flush();
 assert.equal(h.$('txProgress').hidden,false);
 assert.equal(h.$('txProgressSpinner').hidden,false);
 assert.equal(h.$('txProgressLabel').textContent,'AWAITING WALLET SIGNATURE');
 assert.match(h.$('txProgressDetail').textContent,/MetaMask/);
 assert.equal(h.writes.length,0,'must not write before signature approval');
 approve();await action;await flush();
 assert.equal(h.$('txProgressSpinner').hidden,true);
 assert.equal(h.$('txProgressLabel').textContent,'SUCCESS');
 assert.equal(h.writes.length,1);
 assert.equal(h.$('txBox').hidden,true);
});
test('consensus timeout ends the spinner at UNVERIFIED, without resubmitting',async()=>{
 const h=harness({timeout:true});await flush();await h.click('connect');await h.click('ratify');
 assert.equal(h.$('txProgressLabel').textContent,'UNVERIFIED');
 assert.equal(h.$('txProgressSpinner').hidden,true);
 assert.ok(h.storage.has('canonatlas_pending_'+CONTRACT.toLowerCase()));
 assert.equal(h.writes.length,1);
 h.timeout=false;await h.click('resume');
 assert.equal(h.$('txProgressLabel').textContent,'SUCCESS');
 assert.equal(h.$('txProgressSpinner').hidden,true);
 assert.equal(h.writes.length,1);
});
test('public evidence and UI retain full result after completed write; no pending badge remains',async()=>{
 const h=harness();await flush();await h.click('connect');await h.click('ratify');
 assert.equal(h.$('entryStatus').textContent,'RATIFIED');
 assert.equal(h.$('txProgressLabel').textContent,'SUCCESS');
 assert.equal(h.$('txBox').hidden,true);
 assert.equal(h.$('walletAlert').hidden,true);
});

test('transaction widget is global, outside tab-specific workspaces, with a real Explorer link',()=>{
 const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
 const anchor=html.indexOf('id="txProgress"');
 assert.ok(anchor>0);
 assert.ok(anchor<html.indexOf('<nav class="workspace-tabs"'), 'status must be outside all hidden workspace tabs');
 assert.ok(html.includes('id="txProgressProof"'));
 assert.ok(html.includes('id="txProgressHash"'));
 assert.ok(html.includes('id="txProgressLink"'));
});
test('verified finalized write shows explicit SUCCESS, visible TX hash and Explorer link on any screen',async()=>{
 const h=harness();await flush();await h.click('connect');await h.click('ratify');
 assert.equal(h.$('txProgressLabel').textContent,'SUCCESS');
 assert.equal(h.$('txProgressProof').hidden,false);
 assert.match(h.$('txProgressHash').textContent,/0xfffffffff/);
 assert.equal(h.$('txProgressLink').href,'https://explorer-studio.genlayer.com/tx/'+HASH);
 assert.equal(h.$('txProgressSpinner').hidden,true);
 assert.equal(h.$('txProgressResume').hidden,true);
});
test('uncertain outcome still shows TX Explorer link and one-click resume',async()=>{
 const h=harness({timeout:true});await flush();await h.click('connect');await h.click('ratify');
 assert.equal(h.$('txProgressProof').hidden,false);
 assert.equal(h.$('txProgressLink').href,'https://explorer-studio.genlayer.com/tx/'+HASH);
 assert.equal(h.$('txProgressLabel').textContent,'UNVERIFIED');
 assert.equal(h.$('txProgressResume').hidden,false);
 assert.equal(h.writes.length,1);
 h.timeout=false;await h.click('txProgressResume');
 assert.equal(h.$('txProgressLabel').textContent,'SUCCESS');
 assert.equal(h.$('txProgressLink').href,'https://explorer-studio.genlayer.com/tx/'+HASH);
 assert.equal(h.writes.length,1,'resume must never re-submit');
});

test('finished or FAILED transaction notice closes without deleting its archived TX and Explorer link',async()=>{
 const h=harness();await flush();await h.click('connect');await h.click('ratify');
 assert.equal(h.$('txProgress').hidden,false);
 const before=readTxHistory({getItem:k=>h.storage.get(k)||null},CONTRACT);
 assert.equal(before.length,1);
 assert.equal(before[0].hash,HASH);
 assert.equal(before[0].stage,'success');
 await h.click('txProgressDismiss');
 assert.equal(h.$('txProgress').hidden,true);
 assert.equal(h.writes.length,1);
 assert.equal(h.$('txHistoryList').children.length,1);
 const card=h.$('txHistoryList').children[0];
 assert.equal(card.children[1].href,'https://explorer-studio.genlayer.com/tx/'+HASH);
 assert.equal(card.children[0].children[1].textContent,HASH);
 assert.equal(card.children[0].children[0].children[0].textContent,'SUCCESS');
});
test('timeout history remains UNVERIFIED with original hash; resume updates same entry',async()=>{
 const h=harness({timeout:true});await flush();await h.click('connect');await h.click('ratify');
 const storage={getItem:k=>h.storage.get(k)||null};
 assert.equal(readTxHistory(storage,CONTRACT).length,1);
 assert.equal(readTxHistory(storage,CONTRACT)[0].stage,'unverified');
 await h.click('txProgressDismiss');
 assert.equal(h.$('txProgress').hidden,true);
 h.timeout=false;await h.click('resume');
 const rows=readTxHistory(storage,CONTRACT);
 assert.equal(rows.length,1);
 assert.equal(rows[0].stage,'success');
 assert.equal(h.writes.length,1);
});
test('transaction history is a separate workspace; dismiss button is not a wallet action',()=>{
 const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
 assert.match(html,/id="txProgressDismiss"/);
 assert.match(html,/id="txHistoryList"/);
 assert.match(html,/href="#history"/);
 assert.match(html,/data-workspace-screens="overview,canon,proposal,chain,history"/);
});

test('SDK stale status=3 cannot override canonical FINALIZED NO_MAJORITY assessment',async()=>{
 const h=harness({actor:AUTHOR,entryStatus:'SUBMITTED',undetermined:true,staleSdk:true});
 await flush();await h.click('connect');
 assert.equal(h.$('assess').disabled,false);
 await h.click('assess');
 assert.equal(h.$('txProgressLabel').textContent,'FINALIZED · UNDETERMINED');
 assert.equal(h.$('txProgressSpinner').hidden,true);
 assert.equal(h.$('txBox').hidden,true);
 assert.equal(h.$('entryStatus').textContent,'SUBMITTED','unaccepted assessment must not mutate entry');
 assert.equal(h.$('assess').disabled,false,'old finalized pending hash must not lock future actions');
 assert.equal(h.writes.length,1,'must not sign a retry automatically');
 const rows=readTxHistory({getItem:k=>h.storage.get(k)||null},CONTRACT);
 assert.equal(rows.length,1);
 assert.equal(rows[0].stage,'undetermined');
 assert.equal(rows[0].hash,HASH);
 assert.equal(h.storage.has('canonatlas_pending_'+CONTRACT.toLowerCase()),false);
});
test('direct canonical FINALIZED and SDK old Committing receipt select the finalized one',()=>{
 const authoritative=finalReceipt({id:HASH,status:7,result:5,txExecutionResult:1});
 const stale=finalReceipt({status:3, result:0});
 const check=reconcileReceiptSnapshots([authoritative,stale]);
 assert.equal(check.finalized,true);
 assert.equal(check.success,false);
 assert.equal(check.consensus,'NO_MAJORITY');
 assert.equal(isUndeterminedFinal(check),true);
 assert.equal(finalReceipt({status:6,result:5}).finalized,false,'Undetermined decision is not finality');
});
test('unfinalized SDK and canonical snapshots must retain pending and never claim success',async()=>{
 const h=harness({actor:AUTHOR,entryStatus:'SUBMITTED',timeout:true});
 await flush();await h.click('connect');
 await h.click('assess');
 assert.equal(h.$('txProgressLabel').textContent,'UNVERIFIED');
 assert.equal(h.$('txBox').hidden,false);
 assert.equal(h.storage.has('canonatlas_pending_'+CONTRACT.toLowerCase()),true);
 assert.equal(h.$('assess').disabled,true);
 assert.equal(h.writes.length,1);
});

test('FINALIZED MajorityDisagree + FinishedWithError never mislabels AI as failed wallet or committed verdict',async()=>{
 const h=harness({actor:AUTHOR,entryStatus:'SUBMITTED',disagreed:true});
 await flush();await h.click('connect');await h.click('assess');
 assert.equal(h.$('txProgressLabel').textContent,'FINALIZED · UNDETERMINED');
 assert.match(h.$('txProgressDetail').textContent,/MAJORITY_DISAGREE/);
 assert.match(h.$('txProgressDetail').textContent,/FINISHED_WITH_ERROR/);
 assert.equal(h.$('entryStatus').textContent,'SUBMITTED');
 assert.equal(h.$('txBox').hidden,true);
 assert.equal(h.writes.length,1,'never retries signature');
 const records=readTxHistory({getItem:k=>h.storage.get(k)||null},CONTRACT);
 assert.equal(records.length,1);
 assert.equal(records[0].stage,'undetermined');
 assert.equal(h.storage.has('canonatlas_pending_'+CONTRACT.toLowerCase()),false);
});
test('old archived FAILED vote is automatically reconciled from canonical receipt after reload',async()=>{
 const h=harness({actor:AUTHOR,entryStatus:'SUBMITTED',disagreed:true,archivedFailed:true});
 await flush();await flush();await flush();
 const history=readTxHistory({getItem:k=>h.storage.get(k)||null},CONTRACT);
 assert.equal(history.length,1);
 assert.equal(history[0].stage,'undetermined');
 assert.match(history[0].detail,/MAJORITY_DISAGREE/);
 assert.equal(h.$('txProgress').hidden,true,'history repair does not recreate sticky banner');
 assert.equal(h.writes.length,0,'repair is read-only');
});
test('finalized disagreed vote is not NoMajority, but both are unaccepted canon results',()=>{
 const disagreed=finalReceipt({status:7,result:2,txExecutionResult:2});
 assert.equal(disagreed.consensus,'MAJORITY_DISAGREE');
 assert.equal(disagreed.execution,'FINISHED_WITH_ERROR');
 assert.equal(disagreed.success,false);
 assert.equal(isUndeterminedFinal(disagreed),true);
 assert.equal(isUndeterminedFinal(finalReceipt({status:7,result:1,txExecutionResult:1})),false);
});

test('new V1.1 contract address works with UI version gate without reclassifying V1 world data',()=>{
 const app=readFileSync(new URL('../web/main.js',import.meta.url),'utf8');
 assert.match(app,/\['1\.0\.0','1\.1\.0'\]\.includes\(stats\.version\)/);
 assert.match(app,/stats\.citation_mode/);
});

test('V1.1 quick-select has independent address, resets example IDs, and preserves V1 archive selection',()=>{
 const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
 const main=readFileSync(new URL('../web/main.js',import.meta.url),'utf8');
 assert.ok(html.includes('id="selectV11"')&&html.includes('id="selectV1"'));
 assert.ok(main.includes("v11:'0x9a08fa0BcE251D5423af41bf5f287bd32BF3779d'"));
 assert.ok(main.includes("v1:'0x7Ce8aD067679a76a43b3C8f6d64F10A6D8f02eA0'"));
 assert.ok(main.includes("switchContract(DEPLOYMENTS.v11,{resetIds:true})"));
 assert.ok(main.includes("!verifiedDeployment"),'write buttons remain locked until successful final-state stats verification');
});

test('ratify screen is synced to immutable World/Entry LATEST_FINAL instead of old static fixture',async()=>{
 const h=harness({actor:OWNER,entryStatus:'CONSISTENT'});
 await flush();await h.click('connect');
 assert.equal(h.$('breadcrumbWorld').textContent,'THE LANTERN ISLES');
 assert.equal(h.$('entryTitle').value,'The Memory Across the Mist');
 assert.equal(h.$('scene').value,'In year 166, Mira read a mirror memory.');
 assert.equal(h.$('sceneHash').textContent,'b'.repeat(64));
 assert.equal(h.$('sceneCommitLabel').textContent,'SIGNED SCENE COMMITMENT · ON-CHAIN');
 assert.equal(h.$('entryReadbackNote').hidden,false);
 assert.equal(h.$('entryTitle').readOnly,true);
 assert.equal(h.$('scene').readOnly,true);
 assert.equal(h.$('ratify').disabled,false);
 await h.click('ratify');
 assert.equal(h.writes[0].method,'ratify_entry');
 assert.equal(h.writes[0].args[0],1);
 assert.equal(h.$('entryStatus').textContent,'RATIFIED');
 assert.equal(h.$('canonVersion').textContent,'v2');
 assert.equal(h.writes.length,1);
});
test('no on-chain entry selection leaves editable draft, not misleading signed commitment',async()=>{
 const h=harness({actor:AUTHOR,pendingEntry:0,entryExists:false});
 await flush();await h.click('connect');
 assert.equal(h.$('breadcrumbWorld').textContent,'THE LANTERN ISLES');
 assert.equal(h.$('entryTitle').readOnly,false);
 assert.equal(h.$('scene').readOnly,false);
 assert.equal(h.$('entryReadbackNote').hidden,true);
 assert.equal(h.$('sceneCommitLabel').textContent,'SCENE COMMITMENT · DRAFT');
 assert.equal(h.$('propose').disabled,false);
});
test('world title and signed chapter content are not hardcoded in the visible HTML',()=>{
 const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
 assert.ok(html.includes('id="breadcrumbWorld"'));
 assert.ok(html.includes('id="sceneCommitLabel"'));
 assert.ok(html.includes('id="entryReadbackNote"'));
 assert.ok(!html.includes('ATLAS / THE GLASS ARCHIPELAGO /'));
});
