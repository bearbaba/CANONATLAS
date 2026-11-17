import {connectWallet,disconnectWallet,subscribeWalletChanges,read,write,waitForFinalized,getTransactionState,getConsensusReceipt,explorer} from './chain.js';
import {finalReceipt,combineFinalChecks,normalizePendingTx} from './tx-status.js';
import {addressValid,validWorld,validEntry,actionGates} from './safety.js';
const $=id=>document.getElementById(id);
const EXAMPLE_RULES=[
 {id:'CHAR1',kind:'continuity',text:'The Lumen Keepers preserve the solar lantern and none has crossed the Quiet Sea.'},
 {id:'TIME1',kind:'chronology',text:'The port of Ilyra was founded in year 140 and the Great Tide happened in year 162.'},
 {id:'LAW1',kind:'world_rules',text:'Mirrors store memories but cannot transport living bodies across water.'}
];
const example={id:1,owner:'0x'+'a'.repeat(40),title:'The Glass Archipelago',
 premise:'A sea-bound world of light-bearing guardians, memory mirrors and irreversible tides.',
 canon:EXAMPLE_RULES,canon_version:1,canon_sha256:'',pending_entry:0,ratified_entries:[],closed_entries:[]};
const labels={continuity:'Living continuity',chronology:'The timeline',world_rules:'Laws of the world'};
let contract=localStorage.getItem('canonatlas_address')||'0x7Ce8aD067679a76a43b3C8f6d64F10A6D8f02eA0',actor='',world=null,entry=null,busy=false;
const pendingKey=address=>'canonatlas_pending_'+address.toLowerCase();
function loadPending(address){
 try{return normalizePendingTx(JSON.parse(localStorage.getItem(pendingKey(address))),address)}
 catch{return null}
}
let pendingTx=loadPending(contract);
function savePending(record){
 pendingTx=record;
 if(record)localStorage.setItem(pendingKey(contract),JSON.stringify(record));
 else localStorage.removeItem(pendingKey(contract));
}
function showPending(){
 $('txBox').hidden=!pendingTx;
 if(pendingTx)$('txLink').href=explorer(pendingTx.hash);
}
$('contract').value=contract;$('rules').value=JSON.stringify(EXAMPLE_RULES,null,2);
function log(text){$('log').textContent=text}
const writeButtons={create_world:'create',propose_entry:'propose',assess_entry:'assess',
 ratify_entry:'ratify',decline_entry:'decline'};
const lastTxKey=address=>'canonatlas_last_verified_tx_'+address.toLowerCase();
function txProgress(stage,method='',detail='',transactionHash=''){
 const labels={signing:'AWAITING WALLET SIGNATURE',submitted:'TRANSACTION SUBMITTED',
  consensus:'GENLAYER CONSENSUS',readback:'VERIFYING LATEST_FINAL',success:'SUCCESS',
  failed:'FAILED',unverified:'UNVERIFIED'};
 const hash=transactionHash||pendingTx?.hash||'';
 const verifiedHash=/^0x[a-fA-F0-9]{64}$/.test(hash)?hash:'';
 const root=$('txProgress');root.hidden=false;root.className='tx-progress is-'+stage;
 $('txProgressLabel').textContent=labels[stage]||'PROCESSING';
 $('txProgressDetail').textContent=(method?method.replaceAll('_',' ')+' · ':'')+detail;
 $('txProgressSpinner').hidden=!['signing','submitted','consensus','readback'].includes(stage);
 $('txProgressProof').hidden=!verifiedHash;
 $('txProgressHash').textContent=verifiedHash?verifiedHash.slice(0,12)+'…'+verifiedHash.slice(-10):'';
 if(verifiedHash)$('txProgressLink').href=explorer(verifiedHash);
 $('txProgressResume').hidden=!pendingTx||stage!=='unverified';
 for(const [methodName,id] of Object.entries(writeButtons)){
   $(id).classList.toggle('is-tx-loading',
     ['signing','submitted','consensus','readback'].includes(stage)&&method===methodName);
 }
 // Only FINALIZED receipt + verified readback permits a durable success label.
 if(verifiedHash&&['success','failed'].includes(stage)){
  try{if(typeof sessionStorage!=='undefined')sessionStorage.setItem(lastTxKey(contract),
    JSON.stringify({stage,method,detail,hash:verifiedHash}));}catch{}
 }
}
function restoreLastTx(){
 $('txProgress').hidden=true;
 if(pendingTx)return;
 try{
  if(typeof sessionStorage==='undefined')return;
  const v=JSON.parse(sessionStorage.getItem(lastTxKey(contract))||'null');
  if(v&&['success','failed'].includes(v.stage)&&/^0x[a-fA-F0-9]{64}$/.test(v.hash))
    txProgress(v.stage,String(v.method||''),'Last transaction: '+String(v.detail||''),v.hash);
 }catch{}
}

function walletFeedback(message,tone='warning'){
 const node=$('walletAlert');node.hidden=false;node.className='wallet-alert is-'+tone;
 node.textContent=message;
}
function hideWalletFeedback(){
 const node=$('walletAlert');node.hidden=true;node.textContent='';
 node.className='wallet-alert';
}
function setMode(live){$('mode').textContent=live?'LATEST_FINAL · LIVE':'ILLUSTRATIVE PREVIEW';$('mode').classList.toggle('connected',!!live)}
const short=s=>s?`${s.slice(0,8)}…${s.slice(-6)}`:'—';
function renderRules(w){const parent=$('canonList');parent.replaceChildren();
 for(const [i,r] of w.canon.entries()){
  const a=document.createElement('article');a.className='canon-card';
  const id=document.createElement('div');id.className='id';id.textContent=r.id+' · '+r.kind.toUpperCase();
  const num=document.createElement('span');num.className='number';num.textContent=String(i+1).padStart(2,'0');
  const h=document.createElement('h3');h.textContent=labels[r.kind]||(r.kind==='continuity'?'Ratified scene':'Canon record');
  const p=document.createElement('p');p.textContent=r.text;
  a.append(id,num,h,p);parent.append(a);
 }
}
function renderEvidence(){
 const root=$('canonEvidence');root.replaceChildren();
 const checks=entry?.assessment?.checks;
 if(!Array.isArray(checks)||checks.length===0){
  const message=document.createElement('p');message.textContent=
    entry?.status==='REVIEW'?'Consensus did not produce a verified three-criterion assessment; ratification is blocked.':
    'Real methodology references appear after reading an assessed entry at LATEST_FINAL.';
  root.append(message);return;
 }
 for(const check of checks){
  const article=document.createElement('article');article.className='canon-evidence-item';
  const head=document.createElement('strong');
  head.textContent=String(check.criterion||'unknown').replaceAll('_',' ')+' · '+String(check.result||'UNKNOWN');
  const reason=document.createElement('p');reason.textContent=String(check.reason||'No reasoning supplied.');
  article.append(head,reason);
  for(const ref of Array.isArray(check.references)?check.references:[]){
   const div=document.createElement('div');div.className='canon-ref';
   const id=document.createElement('span');id.textContent=String(ref.ref_id||'')+' / '+String(ref.field||'');
   const quote=document.createElement('p');quote.textContent=String(ref.quote||'');
   div.append(id,quote);article.append(div);
  }
  root.append(article);
 }
}

function render(){const w=world||example;renderRules(w);
 renderEvidence();
 $('canonVersion').textContent='v'+w.canon_version;
 $('worldState').textContent=world?'VERIFIED':'PREVIEW';
 $('pendingCount').textContent=world?(w.pending_entry||'NONE'):'—';
 $('canonHash').textContent=world?w.canon_sha256:'No chain commitment in illustrative preview';
 $('entryStatus').textContent=entry?entry.status:'AWAITING SUBMISSION';
 $('verdict').textContent=entry?.assessment?.verdict||'NOT ASSESSED';
 $('reviewNote').textContent=entry?.assessment?.checks?.length?
  entry.assessment.checks.map(c=>`${c.criterion.toUpperCase()} ${c.result}`).join(' · '):
  'A visual preview is not an AI verdict. Only accepted consensus committed to latest-final state is considered verified.';
 const gates=actor?actionGates(world,entry,actor):{};
 for(const action of ['create','propose','assess','ratify','decline'])$(action).disabled=busy||!!pendingTx||!contract||!actor||!gates[action];
 $('load').disabled=busy||!contract;
 $('resume').disabled=busy||!pendingTx;
 $('contract').disabled=busy||!!pendingTx;
 $('worldId').disabled=busy||!!pendingTx;
 $('entryId').disabled=busy||!!pendingTx;
 if(pendingTx)showPending();
 $('walletIdentity').hidden=!actor;
 $('walletIdentity').textContent=actor?short(actor)+' ✓':'';
 $('walletIdentity').title=actor||'';
 $('connect').textContent=actor?'Disconnect':'Connect wallet ↗';
 $('connect').disabled=busy;
}
async function updateHash(){const data=new TextEncoder().encode($('scene').value);
 const arr=new Uint8Array(await crypto.subtle.digest('SHA-256',data));
 const hex=Array.from(arr,b=>b.toString(16).padStart(2,'0')).join('');
 $('sceneHash').textContent=hex;return hex;
}
async function refresh(){contract=$('contract').value.trim();if(!addressValid(contract))throw Error('Enter a valid deployed contract address.');
 const stats=await read(contract,'stats');
 if(stats.name!=='CANONATLAS'||stats.version!=='1.0.0'||stats.citation_mode!=='DETERMINISTIC_REFERENCE_IDS')throw Error('Contract name, version or citation policy mismatch. Signing disabled.');
 const id=Number($('worldId').value);
 if(!Number.isSafeInteger(id)||id<1){world=null;entry=null;log('Contract verified. No world selected yet. Create a world with the steward wallet.');setMode(true);return}
 try{const w=await read(contract,'get_world',[id]);if(!validWorld(w))throw Error('Malformed latest-final world state');world=w;}
 catch(e){if(stats.worlds===0||id>stats.worlds){world=null;entry=null;log('Contract verified, but world #'+id+' does not yet exist. Create one as steward.');setMode(true);return}throw e}
 const entryId=Number($('entryId').value);
 entry=null;
 if(Number.isSafeInteger(entryId)&&entryId>0&&entryId<=stats.entries){
  const e=await read(contract,'get_entry',[entryId]);if(!validEntry(e,world))throw Error('Entry identity or status does not match this world');entry=e;
 }
 setMode(true);log('LATEST_FINAL VERIFIED\nContract '+short(contract)+'\nWorld #'+world.id+' / canon v'+world.canon_version+'\nPending: '+(world.pending_entry||'none')+'\nEntry: '+(entry?.status||'not selected')+'\nNo transaction is marked successful without a final-state readback.');
}
async function run(fn,{wallet=false}={}){
 if(busy){if(wallet)walletFeedback('Reading on-chain state. Try Connect wallet again after this read completes.','warning');return;}
 busy=true;render();
 try{await fn()}
 catch(e){const message=String(e.message||e);log('ACTION BLOCKED / '+message);
  if(wallet)walletFeedback(message+'\nStudio accounts do not automatically connect to an external website. Unlock a browser wallet extension for this domain.','error');
 }finally{busy=false;render()}
}
async function sign(method,args){if(!actor)throw Error('Connect a Studionet wallet first');
 if(!addressValid(contract))throw Error('Contract address not configured');
 const gates=actionGates(world,entry,actor);
 const key={create_world:'create',propose_entry:'propose',assess_entry:'assess',ratify_entry:'ratify',decline_entry:'decline'}[method];
 if(pendingTx)throw Error('Pending transaction hash exists. Resume its verification; never sign the same action twice.');
 if(method!=='create_world'&&!gates[key])throw Error('Current wallet or finalized state does not authorize '+method);
 txProgress('signing',method,'Check MetaMask and confirm or reject the request.');
 log('Wallet signature requested for '+method+'. Inspect the request in MetaMask.');
 let hash;
 try{hash=await write(contract,actor,method,args);}
 catch(error){
  const message=String(error.message||error);
  const rejected=error?.code===4001||/rejected|denied|user rejected/i.test(message);
  txProgress(rejected?'failed':'unverified',method,rejected?
   'Signature rejected. No transaction was submitted.':
   'No hash returned. Check wallet history before retrying: '+message);
  throw error;
 }
 savePending({hash,method,contract,signer:actor,worldId:world?.id??null,entryId:entry?.id??null});
 showPending();
 txProgress('submitted',method,'Transaction hash saved. Awaiting GenLayer finality.');
 log('TRANSACTION SUBMITTED · waiting for FINALIZED\n'+hash+
   '\nNo second wallet signature will be requested while this hash is unresolved.');
 await verifyPending();
}
/** A submitted hash survives refreshes and RPC timeouts. Never resubmit automatically. */
async function verifyPending(){
 if(!pendingTx)throw Error('No pending transaction hash is stored.');
 const record=pendingTx;showPending();
 txProgress('consensus',record.method,'Confirming the original transaction; do not sign twice.');
 log('VERIFYING STORED TX · '+record.method+'\n'+record.hash+'\nWaiting for finality and on-chain readback.');
 try{
   let receipt=await waitForFinalized(record.hash);
   let check=finalReceipt(receipt);
   if(check.finalized&&(check.execution==='UNKNOWN'||check.consensus==='UNKNOWN')){
     for(const reader of [getTransactionState,getConsensusReceipt]){
       if(check.execution!=='UNKNOWN'&&check.consensus!=='UNKNOWN')break;
       try{check=combineFinalChecks(check,finalReceipt(await reader(record.hash)));}
       catch(e){
        if(String(e.message||e).startsWith('Conflicting '))throw e;
        // Keep ambiguous outcomes unverified; never infer success.
       }
     }
   }
   if(check.status==='CANCELED'){
     savePending(null);showPending();
     txProgress('failed',record.method,'CANCELED by GenLayer · no successful execution.',record.hash);
     log('CANCELED · NO SUCCESSFUL EXECUTION\n'+record.hash);
     return;
   }
   if(!check.finalized)throw Error('Transaction has not reached FINALIZED status.');
   txProgress('readback',record.method,'Finalized. Checking execution and persisted world state.');
   if(!check.success){
     if(check.execution==='UNKNOWN'||check.consensus==='UNKNOWN')
       throw Error('Receipt fields are incomplete. Use Explorer; keep this hash for readback.');
     savePending(null);showPending();
     txProgress('failed',record.method,'FINALIZED · unsuccessful execution or consensus: '+check.execution+' / '+check.consensus,record.hash);
     log('FINALIZED BUT NOT SUCCESSFUL · '+check.execution+' / '+check.consensus+
       '\n'+record.hash+'\nNo accepted state is claimed.');return;
   }
   if(record.method==='create_world'){
     const stats=await read(contract,'stats');
     if(Number.isSafeInteger(stats.worlds)&&stats.worlds>0)$('worldId').value=String(stats.worlds);
     $('entryId').value='0';
   }else if(record.method==='propose_entry'){
     const stats=await read(contract,'stats');
     if(Number.isSafeInteger(stats.entries)&&stats.entries>0)$('entryId').value=String(stats.entries);
   }
   await refresh();
   if(record.worldId!=null&&record.method!=='create_world'&&world?.id!==record.worldId)
     throw Error('Selected world does not match the transaction world ID.');
   if(record.entryId!=null&&!['propose_entry','create_world'].includes(record.method)&&entry?.id!==record.entryId)
     throw Error('Selected entry does not match the transaction entry ID.');
   const expected={
     create_world:!!world&&world.owner.toLowerCase()===record.signer,
     propose_entry:!!entry&&entry.author.toLowerCase()===record.signer&&entry.world_id===world?.id,
     assess_entry:!!entry&&entry.author.toLowerCase()===record.signer&&
       ['CONSISTENT','CONFLICT','REVIEW','RATIFIED','DECLINED'].includes(entry.status),
     ratify_entry:entry?.status==='RATIFIED'&&world?.owner?.toLowerCase()===record.signer&&
       world?.ratified_entries?.includes(entry.id),
     decline_entry:entry?.status==='DECLINED'&&world?.owner?.toLowerCase()===record.signer
   };
   if(!expected[record.method])
     throw Error('The expected final result was not found in the selected latest-final world/entry.');
   savePending(null);showPending();
   txProgress('success',record.method,'FINALIZED · accepted consensus · verified LATEST_FINAL. World #'+world.id+' · v'+world.canon_version,record.hash);
   log('VERIFIED · FINALIZED / FINISHED_WITH_RETURN / '+check.consensus+
     '\nWorld #'+world.id+' · canon v'+world.canon_version+
     '\nEntry '+(entry?.id||'none')+' · '+(entry?.status||'WORLD CREATED')+
     '\nTransaction '+record.hash+'\nNo duplicate signature submitted.');
 }catch(e){
   txProgress('unverified',record.method,'Original hash preserved. Resume verification; do not sign again: '+String(e.message||e));
   log('PENDING HASH PRESERVED · '+record.hash+
     '\nStatus not independently verified: '+String(e.message||e)+
     '\nUse Resume verification or open Explorer. Do not blindly sign again.');
 }
}

$('connect').addEventListener('click',()=>{
 if(actor){
  // Disconnect only this website's signer session; never delete stored pending hashes.
  // Some wallets keep site permissions until revoked in the extension itself.
  disconnectWallet();actor='';hideWalletFeedback();
  log('Wallet disconnected from CANONATLAS. On-chain evidence remains readable. You can reconnect at any time.');
  render();return;
 }
 return run(async()=>{
  walletFeedback('Requesting wallet approval… Open the wallet extension to approve.','warning');
  actor=await connectWallet();
  subscribeWalletChanges({
   onAccountsChanged:()=>{
    disconnectWallet();actor='';
    walletFeedback('Wallet account changed. Reconnect before signing.','warning');
    log('Wallet changed; reconnect before any new signature.');render();
   },
   onChainChanged:()=>{
    disconnectWallet();actor='';
    walletFeedback('Wallet network changed. Reconnect to Studionet (61999).','warning');
    log('Network changed; reconnect before signing.');render();
   }
  });
  hideWalletFeedback();
  log('Connected '+actor+' on Studionet. Configure the deployed contract and verify latest-final state.');
 },{wallet:true});
});
$('load').addEventListener('click',()=>run(refresh));
$('resume').addEventListener('click',()=>run(verifyPending));
$('txProgressResume').addEventListener('click',()=>run(verifyPending));
$('contract').addEventListener('change',()=>{
 contract=$('contract').value.trim();
 if(addressValid(contract))localStorage.setItem('canonatlas_address',contract);
 world=null;entry=null;pendingTx=loadPending(contract);setMode(false);render();
 if(pendingTx){
  txProgress('unverified',pendingTx.method,'Stored transaction on this contract; use Resume verification.',pendingTx.hash);
 }else restoreLastTx();
});
$('scene').addEventListener('input',()=>updateHash().catch(e=>log(e.message)));
$('copyHash').addEventListener('click',()=>navigator.clipboard?.writeText($('sceneHash').textContent));
$('create').addEventListener('click',()=>run(async()=>{
 const title=$('worldTitle').value.trim(),premise=$('premise').value.trim();
 const rules=JSON.parse($('rules').value);if(!Array.isArray(rules)||rules.length<3)throw Error('At least three canon dimension rules required.');
 await sign('create_world',[title,premise,JSON.stringify(rules)]);
}));
$('propose').addEventListener('click',()=>run(async()=>{
 if(!world)throw Error('Load a real world from the contract first');
 const scene=$('scene').value;const hash=await updateHash();
 await sign('propose_entry',[world.id,$('entryTitle').value.trim(),scene,hash]);
}));
$('assess').addEventListener('click',()=>run(()=>sign('assess_entry',[entry.id])));
$('ratify').addEventListener('click',()=>run(()=>sign('ratify_entry',[entry.id])));
$('decline').addEventListener('click',()=>run(async()=>{
 const reason=window.prompt('Explain the steward decision (12–280 characters):');
 if(reason===null)return;
 if(reason.length<12||reason.length>280)throw Error('A substantive 12–280 character reason is required');
 await sign('decline_entry',[entry.id,reason]);
}));
render();updateHash().catch(e=>log(e.message));
// Show accepted on-chain canon when available. Never synthesize an on-chain success.
showPending();
if(pendingTx)run(verifyPending);
else{restoreLastTx();run(refresh);}
