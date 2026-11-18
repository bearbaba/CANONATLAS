import {connectWallet,disconnectWallet,subscribeWalletChanges,read,write,waitForFinalized,getTransactionState,getConsensusReceipt,explorer} from './chain.js';
import {finalReceipt,normalizePendingTx,reconcileReceiptSnapshots,isUndeterminedFinal} from './tx-status.js';
import {addressValid,validWorld,validEntry,actionGates} from './safety.js';
import {readTxHistory,upsertTxHistory,migrateLegacyTx} from './history.js';
const $=id=>document.getElementById(id);
const DEPLOYMENTS=Object.freeze({
 v1:'0x7Ce8aD067679a76a43b3C8f6d64F10A6D8f02eA0',
 v11:'0x9a08fa0BcE251D5423af41bf5f287bd32BF3779d'
});
const EXAMPLE_RULES=[
 {id:'CHAR1',kind:'continuity',text:'The Lumen Keepers preserve the solar lantern and none has crossed the Quiet Sea.'},
 {id:'TIME1',kind:'chronology',text:'The port of Ilyra was founded in year 140 and the Great Tide happened in year 162.'},
 {id:'LAW1',kind:'world_rules',text:'Mirrors store memories but cannot transport living bodies across water.'}
];
const example={id:1,owner:'0x'+'a'.repeat(40),title:'The Glass Archipelago',
 premise:'A sea-bound world of light-bearing guardians, memory mirrors and irreversible tides.',
 canon:EXAMPLE_RULES,canon_version:1,canon_sha256:'',pending_entry:0,ratified_entries:[],closed_entries:[]};
const labels={continuity:'Living continuity',chronology:'The timeline',world_rules:'Laws of the world'};
let contract=localStorage.getItem('canonatlas_address')||DEPLOYMENTS.v1,actor='',world=null,entry=null,busy=false,verifiedDeployment=false;
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
let dismissedHash='';
let lastDisplayedEntryKey='';
function renderTxHistory(){
 const root=$('txHistoryList');root.replaceChildren();
 const items=readTxHistory(localStorage,contract);
 if(!items.length){
  const note=document.createElement('p');
  note.className='tx-history-empty';
  note.textContent='No transaction history saved in this browser.';
  root.append(note);return;
 }
 const stageNames={success:'SUCCESS',failed:'FAILED',unverified:'UNVERIFIED',
  submitted:'SUBMITTED',consensus:'IN PROGRESS',readback:'VERIFYING',undetermined:'UNDETERMINED'};
 for(const item of items){
  const card=document.createElement('article');card.className='tx-history-item';
  const info=document.createElement('div');info.className='tx-history-info';
  const header=document.createElement('div');header.className='tx-history-head';
  const badge=document.createElement('span');badge.className='tx-history-state is-'+item.stage;
  badge.textContent=stageNames[item.stage]||'UNVERIFIED';
  const method=document.createElement('strong');method.className='tx-history-method';
  method.textContent=item.method.replaceAll('_',' ');
  header.append(badge,method);
  const hash=document.createElement('code');hash.className='tx-history-hash';hash.textContent=item.hash;
  const detail=document.createElement('p');detail.className='tx-history-detail';detail.textContent=item.detail;
  const date=document.createElement('small');date.className='tx-history-detail';
  date.textContent='Saved in browser: '+new Date(item.savedAt).toLocaleString();
  const link=document.createElement('a');link.href=explorer(item.hash);
  link.target='_blank';link.rel='noopener noreferrer';link.textContent='View TX ↗';
  info.append(header,hash,detail,date);card.append(info,link);root.append(card);
 }
}
function txProgress(stage,method='',detail='',transactionHash=''){
 const labels={signing:'AWAITING WALLET SIGNATURE',submitted:'TRANSACTION SUBMITTED',
  consensus:'GENLAYER CONSENSUS',readback:'VERIFYING LATEST_FINAL',success:'SUCCESS',
  failed:'FAILED',undetermined:'FINALIZED · UNDETERMINED',unverified:'UNVERIFIED'};
 const hash=transactionHash||pendingTx?.hash||'';
 const verifiedHash=/^0x[a-fA-F0-9]{64}$/.test(hash)?hash:'';
 const root=$('txProgress');
 if(stage==='signing')dismissedHash='';
 root.hidden=!!verifiedHash&&dismissedHash===verifiedHash;
 root.className='tx-progress is-'+stage;
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
 // Record observed statuses in a browser-local audit trail. No chain state is modified.
 if(verifiedHash&&method&&['submitted','consensus','readback','unverified','success','failed','undetermined'].includes(stage)){
  upsertTxHistory(localStorage,contract,{stage,method,detail,hash:verifiedHash});
  renderTxHistory();
 }
}
function restoreLastTx(){
 // Migrate the previous release's sticky FAILED/SUCCESS banner to History.
 // An old terminal notification must never automatically reappear after reload.
 try{migrateLegacyTx(localStorage,typeof sessionStorage==='undefined'?null:sessionStorage,contract)}catch{}
 $('txProgress').hidden=true;
 dismissedHash='';
 renderTxHistory();
}

function walletFeedback(message,tone='warning'){
 const node=$('walletAlert');node.hidden=false;node.className='wallet-alert is-'+tone;
 node.textContent=message;
}
function hideWalletFeedback(){
 const node=$('walletAlert');node.hidden=true;node.textContent='';
 node.className='wallet-alert';
}
function setMode(live){
 verifiedDeployment=!!live;
 $('mode').textContent=live?'LATEST_FINAL · LIVE':'ILLUSTRATIVE PREVIEW';
 $('mode').classList.toggle('connected',!!live);
}
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
 // Never show hardcoded Glass Archipelago branding over a verified different world.
 $('breadcrumbWorld').textContent=world?String(world.title||'World #'+world.id).toUpperCase():'NO WORLD SELECTED';
 const signed=!!entry;
 const entryKey=signed?contract.toLowerCase()+':'+entry.id+':'+entry.scene_sha256:'';
 if(signed){
  // Display the immutable committed scene and its original on-chain hash.
  // Steward ratify uses entry.id; it does NOT sign or modify these text fields.
  $('entryTitle').value=String(entry.title||'');
  $('scene').value=String(entry.scene||'');
  $('sceneHash').textContent=entry.scene_sha256;
 }else if(lastDisplayedEntryKey){
  // Deselecting an existing entry must not leave its signed text looking
  // like a new editable proposal. New author drafts begin empty.
  $('entryTitle').value='';
  $('scene').value='';
  $('sceneHash').textContent='Enter a scene to calculate draft SHA-256';
 }
 lastDisplayedEntryKey=entryKey;
 $('entryTitle').readOnly=signed;
 $('scene').readOnly=signed;
 $('sceneCommitLabel').textContent=signed?'SIGNED SCENE COMMITMENT · ON-CHAIN':'SCENE COMMITMENT · DRAFT';
 $('entryReadbackNote').hidden=!signed;
 $('entryReadbackNote').textContent=signed?
  'Entry #'+entry.id+' · '+entry.status+' · Signed on-chain (read-only). To draft another chapter, set ENTRY ID to 0 and read latest-final.':'';

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
 for(const action of ['create','propose','assess','ratify','decline'])$(action).disabled=busy||!!pendingTx||!verifiedDeployment||!contract||!actor||!gates[action];
 $('selectV11').disabled=busy||!!pendingTx;
 $('selectV1').disabled=busy||!!pendingTx;
 $('selectV11').classList.toggle('is-selected',contract.toLowerCase()===DEPLOYMENTS.v11.toLowerCase());
 $('selectV1').classList.toggle('is-selected',contract.toLowerCase()===DEPLOYMENTS.v1.toLowerCase());
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
async function refresh(){
 setMode(false);
 contract=$('contract').value.trim();if(!addressValid(contract))throw Error('Enter a valid deployed contract address.');
 const stats=await read(contract,'stats');
 if(stats.name!=='CANONATLAS'||!['1.0.0','1.1.0'].includes(stats.version)||stats.citation_mode!=='DETERMINISTIC_REFERENCE_IDS')throw Error('Contract name, version or citation policy mismatch. Signing disabled.');
 const id=Number($('worldId').value);
 if(!Number.isSafeInteger(id)||id<1){world=null;entry=null;log('Contract verified. No world selected yet. Create a world with the steward wallet.');setMode(true);return}
 try{const w=await read(contract,'get_world',[id]);if(!validWorld(w))throw Error('Malformed latest-final world state');world=w;}
 catch(e){if(stats.worlds===0||id>stats.worlds){world=null;entry=null;log('Contract verified, but world #'+id+' does not yet exist. Create one as steward.');setMode(true);return}throw e}
 const entryId=Number($('entryId').value);
 entry=null;
 if(Number.isSafeInteger(entryId)&&entryId>0&&entryId<=stats.entries){
  const e=await read(contract,'get_entry',[entryId]);
  // A global entry counter may point at a different world. Ignore the stale
  // selector rather than blocking a verified world or proposing new lore.
  if(validEntry(e,world))entry=e;
  else{$('entryId').value='0';entry=null;}
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
 if(!verifiedDeployment)throw Error('Verify deployed contract stats at LATEST_FINAL before requesting a signature.');
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
 await verifyPending({wait:true});
}
/** Query by original transaction hash first, avoiding SDK polling cached Committing.
 * The canonical receipt verifies its hash; a stale nonfinal SDK snapshot cannot
 * override a FINALIZED consensus receipt. Never sign or broadcast here. */
async function inspectReceiptNow(hash){
 const observations=[],errors=[];
 for(const reader of [getConsensusReceipt,getTransactionState]){
  try{observations.push(finalReceipt(await reader(hash)));}
  catch(e){errors.push(String(e.message||e));}
 }
 if(!observations.length)throw Error('No independent receipt available: '+errors.join(' / '));
 return reconcileReceiptSnapshots(observations);
}

/** Repair the previous release's archived FAILED labels using the exact
 * original receipt, not hardcoded transaction hashes or assumptions from text.
 * A history check never opens a wallet, submits a write, or revives the banner. */
async function reconcileArchivedOutcomes(){
 const boundContract=contract;
 const candidates=readTxHistory(localStorage,boundContract).filter(item=>
  item.stage==='failed'&&item.detail.includes('FINALIZED')).slice(0,3);
 for(const item of candidates){
  try{
   const check=await inspectReceiptNow(item.hash);
   if(boundContract!==contract)return;
   if(isUndeterminedFinal(check)){
    upsertTxHistory(localStorage,boundContract,{hash:item.hash,method:item.method,
     stage:'undetermined',
     detail:'FINALIZED · UNDETERMINED; no accepted consensus. Receipt vote: '+
       check.consensus+'; execution: '+check.execution+'. No canon decision committed.'});
    renderTxHistory();
   }
  }catch{
   // A failed read does not turn archived evidence into success or erase it.
  }
 }
}
/** Resume and page load perform an immediate read-only receipt check. Only the
 * *newly submitted* transaction enters SDK finality polling. */
async function verifyPending({wait=false}={}){
 if(!pendingTx)throw Error('No pending transaction hash is stored.');
 const record=pendingTx;showPending();
 txProgress('consensus',record.method,'Checking the original hash directly against GenLayer; no new signature.');
 log('VERIFYING STORED TX · '+record.method+'\n'+record.hash+'\nChecking canonical receipt and LATEST_FINAL.');
 try{
   let check=await inspectReceiptNow(record.hash);
   if(!check.finalized&&check.status!=='CANCELED'&&wait){
     // A fresh write can still be in consensus. Waiting is only used here;
     // SDK timeout must not override an already-finalized canonical receipt.
     try{
       const waited=finalReceipt(await waitForFinalized(record.hash));
       check=reconcileReceiptSnapshots([check,waited]);
     }catch{}
     // A final check after an SDK timeout handles lagging indexers/status=3.
     const latest=await inspectReceiptNow(record.hash);
     check=reconcileReceiptSnapshots([check,latest]);
   }
   if(check.status==='CANCELED'){
     savePending(null);showPending();
     txProgress('failed',record.method,'CANCELED by GenLayer · no successful execution.',record.hash);
     log('CANCELED · NO SUCCESSFUL EXECUTION\n'+record.hash);
     return;
   }
   if(!check.finalized){
     throw Error('No FINALIZED receipt found yet. Last observed: '+check.status+'. Use Resume later; no new signature.');
   }
   txProgress('readback',record.method,'FINALIZED receipt found. Checking consensus outcome.');
   if(isUndeterminedFinal(check)){
     // MajorityDisagree and NoMajority are distinct vote results, but neither
     // is accepted: an exhausted finalized assessment cannot change canon.
     savePending(null);showPending();
     let readback='Entry state can be checked under World ID / Entry ID in console.';
     try{
       await refresh();
       readback='World #'+(world?.id??'—')+' · Entry '+(entry?.id??'—')+
         ' '+(entry?.status??'not selected')+' at LATEST_FINAL.';
     }catch{}
     const explanation='FINALIZED · UNDETERMINED (no accepted consensus). Receipt vote: '+
       check.consensus+'; execution: '+check.execution+'. No AI verdict was committed. '+readback;
     txProgress('undetermined',record.method,explanation,record.hash);
     log('FINALIZED / UNDETERMINED · '+record.hash+'\n'+explanation+
       '\nTX archived in History; old pending lock cleared. No duplicate signature.');
     return;
   }
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
$('txProgressDismiss').addEventListener('click',()=>{
 // Dismiss only the notification, not the original hash or browser history.
 const known=pendingTx?.hash||readTxHistory(localStorage,contract)[0]?.hash||'';
 dismissedHash=known;
 $('txProgress').hidden=true;
});
$('txHistoryRefresh').addEventListener('click',renderTxHistory);
function switchContract(next,{resetIds=false}={}){
 if(busy||pendingTx){
  log('Resolve the current pending transaction by hash before switching contracts.');
  return;
 }
 if(!addressValid(next))throw Error('Invalid contract address.');
 contract=next;
 $('contract').value=next;
 localStorage.setItem('canonatlas_address',next);
 world=null;entry=null;pendingTx=loadPending(next);
 setMode(false);
 if(resetIds){$('worldId').value='0';$('entryId').value='0';}
 render();
 if(pendingTx){
  txProgress('unverified',pendingTx.method,'Original transaction for this contract; verify before signing.',pendingTx.hash);
 }else{
  restoreLastTx();void reconcileArchivedOutcomes();
 }
 renderTxHistory();
 return run(refresh);
}
$('contract').addEventListener('change',()=>switchContract($('contract').value.trim()));
$('selectV11').addEventListener('click',()=>switchContract(DEPLOYMENTS.v11,{resetIds:true}));
$('selectV1').addEventListener('click',()=>{
  if(!busy&&!pendingTx){$('worldId').value='1';$('entryId').value='1';}
  return switchContract(DEPLOYMENTS.v1,{resetIds:false});
});
$('scene').addEventListener('input',()=>{
 if(entry)return; // On-chain readback is immutable; never replace its hash with a draft hash.
 updateHash().catch(e=>log(e.message));
});
$('copyHash').addEventListener('click',()=>navigator.clipboard?.writeText($('sceneHash').textContent));
$('create').addEventListener('click',()=>run(async()=>{
 const title=$('worldTitle').value.trim(),premise=$('premise').value.trim();
 const rules=JSON.parse($('rules').value);if(!Array.isArray(rules)||rules.length<3)throw Error('At least three canon dimension rules required.');
 await sign('create_world',[title,premise,JSON.stringify(rules)]);
}));
$('propose').addEventListener('click',()=>run(async()=>{
 if(!world)throw Error('Load a real world from the contract first');
 if(entry)throw Error('A signed entry is selected. Set ENTRY ID to 0 and read latest-final before drafting a new chapter.');
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
restoreLastTx();
if(pendingTx)run(verifyPending);
else{
 run(refresh);
 void reconcileArchivedOutcomes();
}
