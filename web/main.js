import {connectWallet,read,write,explorer} from './chain.js';
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
let contract=localStorage.getItem('canonatlas_address')||'',actor='',world=null,entry=null,busy=false;
$('contract').value=contract;$('rules').value=JSON.stringify(EXAMPLE_RULES,null,2);
function log(text){$('log').textContent=text}
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
function render(){const w=world||example;renderRules(w);
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
 for(const action of ['create','propose','assess','ratify','decline'])$(action).disabled=busy||!contract||!actor||!gates[action];
 $('load').disabled=busy||!contract;
 $('connect').textContent=actor?short(actor)+' ✓':'Connect wallet ↗';
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
async function run(fn){if(busy)return;busy=true;render();try{await fn()}catch(e){log('ACTION BLOCKED / '+String(e.message||e))}finally{busy=false;render()}}
async function sign(method,args){if(!actor)throw Error('Connect a Studionet wallet first');
 if(!addressValid(contract))throw Error('Contract address not configured');
 const gates=actionGates(world,entry,actor);
 const key={create_world:'create',propose_entry:'propose',assess_entry:'assess',ratify_entry:'ratify',decline_entry:'decline'}[method];
 if(method!=='create_world'&&!gates[key])throw Error('Current wallet or finalized state does not authorize '+method);
 log('Wallet signature requested for '+method+'. Inspect the transaction and then click Read latest-final.');
 const hash=await write(contract,actor,method,args);
 $('txBox').hidden=false;$('txLink').href=explorer(hash);
 log('TRANSACTION SUBMITTED (not yet finalized)\n'+hash+'\nOpen Explorer to check validator consensus; then use Read latest-final. Do not equate a leader result with accepted consensus.');
}
$('connect').addEventListener('click',()=>run(async()=>{actor=await connectWallet();log('Connected '+actor+' on Studionet. Configure the deployed contract and verify latest-final state.');}));
$('load').addEventListener('click',()=>run(refresh));
$('contract').addEventListener('change',()=>{contract=$('contract').value.trim();if(addressValid(contract))localStorage.setItem('canonatlas_address',contract);world=null;entry=null;setMode(false);render()});
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
