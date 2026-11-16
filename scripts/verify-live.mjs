/** CANONATLAS: read-only live deployment attestation. No signer, no wallet or writes. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createClient} from 'genlayer-stable';
import {studionet} from 'genlayer-stable/chains';
import {TransactionHashVariant} from 'genlayer-stable/types';

const address=process.env.CANONATLAS_CONTRACT_ADDRESS;
if(!/^0x[0-9a-fA-F]{40}$/.test(address||''))throw Error('CANONATLAS_CONTRACT_ADDRESS must be valid.');
const client=createClient({chain:studionet});
const code=readFileSync('contracts/canon_atlas.py','utf8');
const normalize=s=>s.replace(/\r\n/g,'\n').replace(/\n+$/,'');
const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
const deployed=await client.getContractCode(address);
if(typeof deployed!=='string'||!deployed.startsWith('# { "Depends": "py-genlayer:'))throw Error('Unexpected deployed source');
if(normalize(deployed)!==normalize(code))throw Error('Deployed code does not match the GitHub candidate after line-ending normalization. Stop signing.');
const raw=await client.readContract({address,functionName:'stats',args:[],transactionHashVariant:TransactionHashVariant.LATEST_FINAL});
const stats=typeof raw==='string'?JSON.parse(raw):raw;
const checks={
 name:stats?.name==='CANONATLAS',
 version:stats?.version==='1.0.0',
 citations:stats?.citation_mode==='DETERMINISTIC_REFERENCE_IDS',
 ratification:stats?.ratification==='STEWARD_AFTER_CONSENSUS',
 criteria:JSON.stringify(stats?.criteria)===JSON.stringify(['continuity','chronology','world_rules']),
 worlds:Number.isInteger(stats?.worlds)&&stats.worlds>=0,
 entries:Number.isInteger(stats?.entries)&&stats.entries>=0
};
if(Object.values(checks).some(v=>!v))throw Error('Unexpected on-chain policy '+JSON.stringify({checks,stats}));

// Verify actual committed world state when a world exists; no ledger artifact uploaded.
let worldVerification=null;
if(stats.worlds>0){
 const rawWorld=await client.readContract({address,functionName:'get_world',args:[1],transactionHashVariant:TransactionHashVariant.LATEST_FINAL});
 const world=typeof rawWorld==='string'?JSON.parse(rawWorld):rawWorld;
 const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?
   Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)])):x;
 const ruleHash=hash(JSON.stringify(stable(world.canon)));
 const kinds=new Set(world.canon.map(rule=>rule.kind));
 const worldChecks={
  world_id:world.id===1,
  owner:/^0x[a-f0-9]{40}$/.test(world.owner||''),
  title:typeof world.title==='string'&&world.title.length>=5,
  canon_version:Number.isInteger(world.canon_version)&&world.canon_version>=1,
  canon_rules:Array.isArray(world.canon)&&world.canon.length>=3,
  all_dimensions:['continuity','chronology','world_rules'].every(kind=>kinds.has(kind)),
  canon_hash:world.canon_sha256===ruleHash,
  active_pending:Number.isInteger(world.pending_entry)&&world.pending_entry>=0,
  finality:'LATEST_FINAL'
 };
 if(Object.values(worldChecks).some(v=>v===false))throw Error('Invalid finalized world '+JSON.stringify({worldChecks,world}));
 worldVerification={id:world.id,owner:world.owner,title:world.title,canon_version:world.canon_version,
    canon_sha256:world.canon_sha256,pending_entry:world.pending_entry,checks:worldChecks};
}


let entryVerification=null;
if(stats.entries>0){
 const rawEntry=await client.readContract({address,functionName:'get_entry',args:[1],transactionHashVariant:TransactionHashVariant.LATEST_FINAL});
 const rawWorld=await client.readContract({address,functionName:'get_world',args:[1],transactionHashVariant:TransactionHashVariant.LATEST_FINAL});
 const rawBank=await client.readContract({address,functionName:'get_reference_bank',args:[1],transactionHashVariant:TransactionHashVariant.LATEST_FINAL});
 const parsed=x=>typeof x==='string'?JSON.parse(x):x;
 const entry=parsed(rawEntry),world=parsed(rawWorld),bank=parsed(rawBank);
 const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?
   Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)])):x;
 const firstCanon=hash(JSON.stringify(stable(entry.canon_snapshot)));
 const cited=new Set();
 const citations=entry.assessment?.checks;
 const literalCitations=Array.isArray(citations)&&citations.length===3&&citations.every(check=>{
   if(!['continuity','chronology','world_rules'].includes(check.criterion)||cited.has(check.criterion)||check.result!=='PASS')return false;
   cited.add(check.criterion);
   if(!Array.isArray(check.references)||check.references.length<2||check.references.length>4)return false;
   const unique=new Set(),fields=[];
   for(const ref of check.references){
     const source=bank[ref.ref_id];
     if(!source||source.field!==ref.field||source.quote!==ref.quote||unique.has(ref.ref_id))return false;
     fields.push(ref.field);unique.add(ref.ref_id);
   }
   return fields.includes('scene')&&fields.includes(check.criterion);
 });
 const record=world.canon.find(rule=>rule.id==='ENTRY_1');
 const entryChecks={
  entry_id:entry.id===1&&entry.world_id===world.id,
  signed_author:/^0x[a-f0-9]{40}$/.test(entry.author||'')&&entry.author!==world.owner,
  scene_sha256:entry.scene_sha256===hash(entry.scene),
  frozen_initial_canon_sha256:entry.canon_sha256===firstCanon,
  frozen_initial_version:entry.canon_version===1,
  ai_consensus_stored:entry.assessment?.verdict==='CONSISTENT'&&literalCitations&&entry.assessment_runs===1,
  entry_ratified:entry.status==='RATIFIED',
  steward_world_v2:world.canon_version===2,
  no_pending_entry:world.pending_entry===0,
  ratification_receipt:Array.isArray(world.ratified_entries)&&world.ratified_entries.includes(1),
  canonical_entry_proven:!!record&&record.kind==='continuity'&&record.text===entry.scene,
  canonical_hash_changed:world.canon_sha256!==entry.canon_sha256,
  active_canon_length:world.canon.length===entry.canon_snapshot.length+1
 };
 if(Object.values(entryChecks).some(x=>!x))throw Error('Entry / AI consensus / Steward ratification failed: '+JSON.stringify({entryChecks,status:entry.status,worldVersion:world.canon_version}));
 entryVerification={id:entry.id,world_id:entry.world_id,author:entry.author,scene_sha256:entry.scene_sha256,
   status:entry.status,consensus:entry.assessment.verdict,criteria:citations.map(c=>c.criterion+':'+c.result),
   assessment_runs:entry.assessment_runs,ratified_world_version:world.canon_version,
   frozen_canon_sha256:entry.canon_sha256,new_canon_sha256:world.canon_sha256,
   check_count:Object.keys(entryChecks).length,checks:entryChecks};
}

console.log(JSON.stringify({
 verified:true,address,network:'GenLayer Studionet',chain_id:61999,
 deployed_code_sha256:hash(deployed),source_matches_after_line_normalization:true,
 stats,worldVerification,entryVerification,finality:'LATEST_FINAL',no_write:true
},null,2));
