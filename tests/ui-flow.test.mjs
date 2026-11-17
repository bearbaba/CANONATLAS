import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
import {finalReceipt,normalizePendingTx} from '../web/tx-status.js';
import {addressValid,validWorld,validEntry,actionGates} from '../web/safety.js';

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
function harness({actor=OWNER,entryStatus='CONSISTENT',timeout=false,pendingEntry,entryExists=true}={}){
 const nodes=new Map(),events={},writes=[],storage=new Map();
 const initial={worldId:'1',entryId:'1',worldTitle:'The Glass Archipelago',
   premise:'A sea-bound world of original imaginary characters.',
   scene:'In year 166, Mira studied a memory mirror while nobody crossed the Quiet Sea.',
   entryTitle:'A memory of the harbor'};
 const $=id=>{if(!nodes.has(id)){const x=element();x.value=initial[id]||'';nodes.set(id,x)}return nodes.get(id)};
 let world={id:1,owner:OWNER,canon_version:1,canon:RULES,
   pending_entry:pendingEntry??1,ratified_entries:[],closed_entries:[],canon_sha256:'a'.repeat(64)};
 let worldsCount=1,entriesCount=1;
 let entry=entryExists?{id:1,world_id:1,author:AUTHOR,status:entryStatus,canon_version:1,
   scene:'In year 166, Mira read a mirror memory.',scene_sha256:'b'.repeat(64),
   assessment_runs:entryStatus==='SUBMITTED'?0:1,assessment:{verdict:'CONSISTENT',checks:[
    {criterion:'chronology',result:'PASS',reason:'The time sequence matches frozen canon.',
      references:[{ref_id:'TIME1:1',field:'chronology',quote:'A storm occurred in year 162.'}]}
   ]}}:null;
 let shouldTimeout=timeout;
 const deps={
  connectWallet:async()=>actor,
  read:async(_addr,method)=>method==='stats'?{name:'CANONATLAS',version:'1.0.0',citation_mode:'DETERMINISTIC_REFERENCE_IDS',worlds:worldsCount,entries:entriesCount}:
    method==='get_world'?structuredClone(world):structuredClone(entry),
  write:async(_addr,_signer,method,args)=>{writes.push({method,args});
   if(method==='ratify_entry'){entry={...entry,status:'RATIFIED'};world={...world,canon_version:2,
      pending_entry:0,ratified_entries:[1],canon:[...RULES,{id:'ENTRY_1',kind:'continuity',text:entry.scene}]};}
   else if(method==='assess_entry'){entry={...entry,status:'CONSISTENT',assessment_runs:1};}
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
  waitForFinalized:async()=>{if(shouldTimeout)throw Error('temporary remote RPC timeout');return {
    statusName:'FINALIZED',resultName:'MAJORITY_AGREE',txExecutionResultName:'FINISHED_WITH_RETURN'}},
  getTransactionState:async()=>({statusName:'FINALIZED',resultName:'MAJORITY_AGREE',
    txExecutionResultName:'FINISHED_WITH_RETURN'}),
  explorer:hash=>'https://explorer-studio.genlayer.com/tx/'+hash
 };
 const code=readFileSync(new URL('../web/main.js',import.meta.url),'utf8')
  .replace(/^import .*;\s*$/gm,'');
 const imports=`const {connectWallet,read,write,waitForFinalized,getTransactionState,explorer}=globalThis.deps;
const {finalReceipt,normalizePendingTx}=globalThis.tx;
const {addressValid,validWorld,validEntry,actionGates}=globalThis.safety;`;
 runInNewContext(imports+code,{
  deps,tx:{finalReceipt,normalizePendingTx},safety:{addressValid,validWorld,validEntry,actionGates},
  document:{getElementById:$,createElement:element},window:{ethereum:{on:(key,cb)=>events[key]=cb}},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),
    removeItem:k=>storage.delete(k)},
  crypto:webcrypto,TextEncoder,Number,console
 });
 return {nodes,writes,events,storage,$,get world(){return world},get entry(){return entry},
  set timeout(value){shouldTimeout=value},
  async click(id){const handler=$(id).handlers.click;assert.ok(handler,'button '+id+' is not wired');
   handler();await flush();await flush();await flush()}
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
 assert.equal(h.storage.size,1);
 assert.equal(h.writes.length,1);
 assert.equal(h.$('ratify').disabled,true);
 assert.equal(h.$('resume').disabled,false);
 h.timeout=false;await h.click('resume');
 assert.equal(h.writes.length,1);
 assert.equal(h.storage.size,0);
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
