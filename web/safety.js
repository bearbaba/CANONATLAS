export const addressValid=x=>typeof x==='string'&&/^0x[a-fA-F0-9]{40}$/.test(x);
export function normalizeRead(x){
  if(typeof x==='string'){try{return JSON.parse(x)}catch{throw Error('Unexpected non-JSON contract read')}}
  if(x&&typeof x==='object')return x;
  throw Error('Unsupported contract read response');
}
export function validWorld(w,actor){
  return !!w&&Number.isInteger(w.id)&&w.id>0&&addressValid(w.owner)&&
    Number.isInteger(w.canon_version)&&w.canon_version>0&&
    Array.isArray(w.canon)&&w.canon.length>=3&&
    (actor==null||actor.toLowerCase()===w.owner.toLowerCase());
}
export function validEntry(e,world){
  return !!e&&Number.isInteger(e.id)&&e.id>0&&e.world_id===world?.id&&
    /^([a-f0-9]{64})$/.test(e.scene_sha256||'')&&
    ['SUBMITTED','CONSISTENT','CONFLICT','REVIEW','RATIFIED','DECLINED'].includes(e.status)&&
    e.canon_version<=world.canon_version;
}
export function actionGates(world,entry,actor){
  const s=actor?.toLowerCase();
  const hasActor=addressValid(actor);
  const own=hasActor&&s===world?.owner?.toLowerCase();
  const author=hasActor&&s===entry?.author?.toLowerCase();
  const pending=!!entry&&world?.pending_entry===entry.id;
  return {
    create:hasActor,
    propose:hasActor&&!own&&world?.pending_entry===0&&world.canon.length<18,
    assess:author&&pending&&entry.status==='SUBMITTED'&&entry.assessment_runs===0,
    ratify:own&&pending&&entry.status==='CONSISTENT'&&entry.canon_version===world.canon_version,
    decline:own&&pending&&['CONSISTENT','CONFLICT','REVIEW'].includes(entry.status),
  };
}
export function classifyTransaction(tx){
  const status=String(tx?.status||tx?.state||'').toUpperCase();
  const consensus=String(tx?.consensus_result||tx?.consensusResult||tx?.consensus||'').toUpperCase();
  const final=status==='FINALIZED';
  const agreed=['ACCEPTED','MAJORITYAGREE'].includes(consensus);
  return {status,consensus,accepted:final&&agreed,final};
}
