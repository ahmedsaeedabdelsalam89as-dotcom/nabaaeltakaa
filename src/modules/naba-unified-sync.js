/* NABA Unified Sync Core 1.3.0
   Shared by Windows + Android. Backend adapter is injected separately.
*/
(function(g){
"use strict";
const KQ="naba_unified_queue_v130", KS="naba_unified_state_v130", KA="naba_unified_audit_v130";
const jget=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch(_){return d}};
const jset=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){throw new Error('NABA_SYNC_STORAGE_WRITE_FAILED:'+String(e&&e.message||e))}};
const uuid=()=> (crypto&&crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(36).slice(2));
const deviceId=()=>{let s=jget(KS,{}); if(!s.deviceId){s.deviceId="dev-"+uuid();jset(KS,s)} return s.deviceId};
function audit(kind,data){let a=jget(KA,[]);a.push({id:uuid(),kind,data,at:new Date().toISOString(),deviceId:deviceId()});if(a.length>2000)a=a.slice(-2000);jset(KA,a)}
function normalize(collection,id,payload,baseRevision){
 return {collection,id:id||uuid(),payload,revision:(baseRevision||0)+1,updatedAt:new Date().toISOString(),deviceId:deviceId(),operationId:uuid(),deleted:false};
}
function enqueue(collection,id,payload,baseRevision=0){
 let q=jget(KQ,[]), op=normalize(collection,id,payload,baseRevision);
 q.push({...op,status:"pending",attempts:0,nextRetryAt:0,lastError:null});jset(KQ,q);audit("enqueue",{operationId:op.operationId,collection,id:op.id});return op;
}
function pending(){return jget(KQ,[]).filter(x=>x.status!=="synced")}
function backoff(n){return Math.min(300000,1000*Math.pow(2,Math.min(n,8)))}
async function flush(adapter){
 if(!adapter||typeof adapter.push!=="function") return {ok:false,reason:"NO_BACKEND_ADAPTER",pending:pending().length};
 let q=jget(KQ,[]),now=Date.now(),done=0,failed=0,conflicts=0;
 for(const x of q){
  if(x.status==="synced"||(+x.nextRetryAt||0)>now)continue;
  x.status="syncing";jset(KQ,q);
  try{
   const r=await adapter.push(x);
   if(r&&r.conflict){x.status="conflict";x.lastError="REVISION_CONFLICT";conflicts++;audit("conflict",{operationId:x.operationId,remote:r.remote});}
   else{x.status="synced";x.syncedAt=new Date().toISOString();done++;audit("synced",{operationId:x.operationId});}
  }catch(e){x.attempts=(x.attempts||0)+1;x.status="pending";x.lastError=String(e&&e.message||e);x.nextRetryAt=Date.now()+backoff(x.attempts);failed++;}
  jset(KQ,q);
 }
 return {ok:failed===0&&conflicts===0,done,failed,conflicts,pending:pending().length};
}
function resolveConflict(local,remote,choice){
 if(choice==="remote")return remote;
 if(choice==="local")return {...local,revision:Math.max(local.revision||0,remote.revision||0)+1,operationId:uuid(),updatedAt:new Date().toISOString()};
 throw new Error("Conflict requires explicit local/remote choice for safety-critical fleet data");
}
g.NABA_UNIFIED={version:"1.3.0",deviceId,enqueue,pending,flush,resolveConflict,audit,keys:{queue:KQ,state:KS,audit:KA}};
})(window);