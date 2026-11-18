/** Read-only CANONATLAS V1.1 deployment attestation. No wallet, no writes.
 * Fail if Studio imported a different code revision or the deployment is not
 * available in LATEST_FINAL. V1 evidence is checked separately in CI.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createClient} from 'genlayer-stable';
import {studionet} from 'genlayer-stable/chains';
import {TransactionHashVariant} from 'genlayer-stable/types';

const address='0x9a08fa0BcE251D5423af41bf5f287bd32BF3779d';
const original='0x7Ce8aD067679a76a43b3C8f6d64F10A6D8f02eA0';
if(address.toLowerCase()===original.toLowerCase())throw Error('New deployment must have its own address.');
const client=createClient({chain:studionet});
const expected=readFileSync('contracts/canon_atlas_v11.py','utf8');
const deployed=await client.getContractCode(address);
const normalize=s=>s.replace(/\r\n/g,'\n').replace(/\n+$/,'');
const sha=s=>createHash('sha256').update(s).digest('hex');
if(typeof deployed!=='string'||!deployed.startsWith('# { "Depends": "py-genlayer:'))
 throw Error('V1.1 deployed source is not available: deployment may still be Accepted rather than Finalized.');
if(normalize(deployed)!==normalize(expected)){
 throw Error('V1.1 deployed source does NOT match GitHub V1.1 candidate. '+
  JSON.stringify({expected_sha256:sha(normalize(expected)),deployed_sha256:sha(normalize(deployed))}));
}
const response=await client.readContract({
 address,functionName:'stats',args:[],transactionHashVariant:TransactionHashVariant.LATEST_FINAL
});
const stats=typeof response==='string'?JSON.parse(response):response;
const expectedCriteria=['continuity','chronology','world_rules'];
const fields={
 name:stats?.name==='CANONATLAS',
 version:stats?.version==='1.1.0',
 citation_mode:stats?.citation_mode==='DETERMINISTIC_REFERENCE_IDS',
 steward_ratification:stats?.ratification==='STEWARD_AFTER_CONSENSUS',
 criteria:JSON.stringify(stats?.criteria)===JSON.stringify(expectedCriteria),
 world_count:Number.isSafeInteger(stats?.worlds)&&stats.worlds>=0,
 entry_count:Number.isSafeInteger(stats?.entries)&&stats.entries>=0
};
if(Object.values(fields).some(ok=>!ok))
 throw Error('V1.1 LATEST_FINAL policy mismatch: '+JSON.stringify({fields,stats}));
console.log(JSON.stringify({
 verified:true,address,chain_id:61999,finality:'LATEST_FINAL',
 deployed_source_sha256:sha(normalize(deployed)),stats,checks:fields,
 note:'Deployment identity/readability verified. No new signed consensus test was performed.',
 no_wallet:true,no_write:true
},null,2));
