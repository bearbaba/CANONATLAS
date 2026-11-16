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
console.log(JSON.stringify({
 verified:true,address,network:'GenLayer Studionet',chain_id:61999,
 deployed_code_sha256:hash(deployed),source_matches_after_line_normalization:true,
 stats,finality:'LATEST_FINAL',no_write:true
},null,2));
