import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('src/index.html','utf8');
function extractFunction(name){
  const key='function '+name+'(';
  const start=html.indexOf(key); if(start<0) throw new Error('Missing '+name);
  const brace=html.indexOf('{',start); let depth=0, quote='', esc=false;
  for(let i=brace;i<html.length;i++){
    const c=html[i];
    if(quote){ if(esc){esc=false;continue;} if(c==='\\'){esc=true;continue;} if(c===quote)quote=''; continue; }
    if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
    if(c==='{')depth++; else if(c==='}' && --depth===0) return html.slice(start,i+1);
  }
  throw new Error('Unclosed '+name);
}
const tick=()=>new Promise(r=>setTimeout(r,0));

// 1) saveState must fail closed, rollback memory, and suppress sync after storage failure.
{
  let applied=null, syncCalls=0, toast='';
  const durable={FLEET:[{plate:'OLD'}]};
  const ctx={console,JSON,Date,window:{},APP:{FLEET:[{plate:'NEW'}]},STORAGE_KEY:'state',NABA_LAST_SAVE_FAILURE_AT:0,
    localStorage:{setItem(){const e=new Error('quota');e.name='QuotaExceededError';throw e;},getItem(){return JSON.stringify(durable)}},
    fullStateSnapshot:()=>({FLEET:[{plate:'NEW'}]}),invalidateNabaCache(){},applyStateObject(x){applied=x;ctx.APP.FLEET=x.FLEET},
    updateSyncTrackingForSave(){syncCalls++},schedulePushToSyncServer(){syncCalls++},renderAlertsBell(){},showToast(x){toast=x}
  };
  vm.createContext(ctx); vm.runInContext(extractFunction('saveState'),ctx);
  if(ctx.saveState()!==false) throw new Error('saveState did not fail closed');
  if(applied?.FLEET?.[0]?.plate!=='OLD' || ctx.APP.FLEET[0].plate!=='OLD') throw new Error('saveState rollback failed');
  if(syncCalls!==0) throw new Error('sync ran after failed persistence');
  if(!/تعذَّر حفظ/.test(toast)) throw new Error('save failure not visible');
}

// 2) external restore must rollback to pre-restore state if durable save fails.
{
  const toasts=[]; let rendered=0;
  const ctx={console,JSON,window:{},NABA_MAX_RESTORE_FILE_BYTES:100*1024*1024,NABA_STATE_ARRAY_FIELDS:['FLEET'],APP:{FLEET:[{plate:'OLD'}]},
    validateStateArraysShape:o=>({ok:Array.isArray(o.FLEET),bad:[]}),fullStateSnapshot(){return {FLEET:JSON.parse(JSON.stringify(ctx.APP.FLEET))}},
    applyStateObject(o){ctx.APP.FLEET=JSON.parse(JSON.stringify(o.FLEET||[]))},logActivity(){},saveState:()=>false,renderAll(){rendered++},showToast(x){toasts.push(x)},
    FileReader:class {readAsText(file){this.onload({target:{result:file.text}})}}
  };
  vm.createContext(ctx); vm.runInContext(extractFunction('handleRestore'),ctx);
  const event={target:{files:[{size:20,text:JSON.stringify({FLEET:[{plate:'RESTORED'}]})}],value:'x'}};
  ctx.handleRestore(event);
  if(ctx.APP.FLEET[0].plate!=='OLD') throw new Error('restore rollback failed after save failure');
  if(rendered!==0) throw new Error('restore rendered success after save failure');
  if(!toasts.some(x=>/فشل الاستيراد/.test(x))) throw new Error('restore failure not visible');
}

// 3) valid external restore must persist and render on success.
{
  const toasts=[]; let rendered=0, saved=0;
  const ctx={console,JSON,window:{},NABA_MAX_RESTORE_FILE_BYTES:100*1024*1024,NABA_STATE_ARRAY_FIELDS:['FLEET'],APP:{FLEET:[{plate:'OLD'}]},
    validateStateArraysShape:o=>({ok:Array.isArray(o.FLEET),bad:[]}),fullStateSnapshot(){return {FLEET:JSON.parse(JSON.stringify(ctx.APP.FLEET))}},
    applyStateObject(o){ctx.APP.FLEET=JSON.parse(JSON.stringify(o.FLEET||[]))},logActivity(){},saveState:()=>{saved++;return true},renderAll(){rendered++},showToast(x){toasts.push(x)},
    FileReader:class {readAsText(file){this.onload({target:{result:file.text}})}}
  };
  vm.createContext(ctx); vm.runInContext(extractFunction('handleRestore'),ctx);
  const event={target:{files:[{size:20,text:JSON.stringify({FLEET:[{plate:'RESTORED'}]})}],value:'x'}};
  ctx.handleRestore(event);
  if(ctx.APP.FLEET[0].plate!=='RESTORED' || saved!==1 || rendered!==1) throw new Error('restore success path failed');
  if(!toasts.some(x=>/بنجاح/.test(x))) throw new Error('restore success not visible');
}

// 4) Smart Import vehicle document: verified save persists/link/update and clears only after save succeeds.
{
  let clear=0, successToast='', archive=[];
  const vehicle={plate:'ABC123',registration_expiry:'2026-01-01'};
  const els={
    '#vdocPlateInput':{value:'ABC123'},'#vdocTypeSelect':{value:'استمارة'},'#vdocExpiryInput':{value:'2027-01-01'},'#vdocUpdateFieldCheck':{checked:true},
    '#page-documents':null,'#page-vehicleDetail':null
  };
  const ctx={console,Date,Promise,window:{},APP:{FLEET:[vehicle],DOCUMENTS_LIBRARY:[],VERIFIED_INFORMATION:[]},
    $:s=>els[s]||null,resolveAny:x=>({plate:x}),fileExt:()=> 'pdf',MAX_DOC_RAW_BYTES:50_000_000,MAX_DOC_IMAGE_SOURCE_BYTES:50_000_000,
    formatFileSize:n=>String(n),readFileAsDataUrl:()=>Promise.resolve('data:application/pdf;base64,QQ=='),compressImageDataUrl:x=>Promise.resolve(x),showToast:x=>{successToast=x},
    VEHICLE_DOC_TYPE_EXPIRY_FIELD:{'استمارة':'registration_expiry'},vehicleDocTypeInfo:x=>({label:x}),nowIso:()=> '2026-09-11T00:00:00Z',
    registerVerifiedInformation:o=>{ctx.APP.VERIFIED_INFORMATION.push(o);return o},saveState:()=>true,logActivity(){},archiveImportEntry:o=>archive.push(o),
    renderDocumentsPage(){},renderVehicleDetail(){},renderAlertsBell(){},clearSmartImportPending(){clear++},CURRENT_VEHICLE_DETAIL_PLATE:null
  };
  vm.createContext(ctx); vm.runInContext(extractFunction('confirmVehicleDocumentRouting'),ctx);
  ctx.confirmVehicleDocumentRouting({sourceFile:{name:'reg.pdf',size:10,type:'application/pdf'},sourceName:'reg.pdf',kind:'vehicle_document',data:{plate:'ABC123',docType:'استمارة',expiryDate:'2027-01-01'}},null,'موثق');
  await tick(); await tick();
  if(ctx.APP.DOCUMENTS_LIBRARY.length!==1 || ctx.APP.DOCUMENTS_LIBRARY[0].plate!=='ABC123') throw new Error('Smart Import link/persist path failed');
  if(vehicle.registration_expiry!=='2027-01-01') throw new Error('Verified document did not update expiry');
  if(clear!==1 || !/تم حفظ المستند/.test(successToast)) throw new Error('Smart Import success did not close visibly');
  if(!archive.some(x=>/تم حفظ المستند/.test(x.status||''))) throw new Error('Smart Import success not archived');
}

// 5) Smart Import must keep the pending review alive when persistence fails, enabling retry.
{
  let clear=0, toasts=[];
  const vehicle={plate:'ABC123',registration_expiry:'2026-01-01'};
  const els={'#vdocPlateInput':{value:'ABC123'},'#vdocTypeSelect':{value:'استمارة'},'#vdocExpiryInput':{value:'2027-01-01'},'#vdocUpdateFieldCheck':{checked:true},'#page-documents':null,'#page-vehicleDetail':null};
  const ctx={console,Date,Promise,window:{},APP:{FLEET:[vehicle],DOCUMENTS_LIBRARY:[],VERIFIED_INFORMATION:[]},$:s=>els[s]||null,resolveAny:x=>({plate:x}),fileExt:()=> 'pdf',MAX_DOC_RAW_BYTES:50_000_000,MAX_DOC_IMAGE_SOURCE_BYTES:50_000_000,formatFileSize:n=>String(n),readFileAsDataUrl:()=>Promise.resolve('data:application/pdf;base64,QQ=='),compressImageDataUrl:x=>Promise.resolve(x),showToast:x=>toasts.push(x),VEHICLE_DOC_TYPE_EXPIRY_FIELD:{'استمارة':'registration_expiry'},vehicleDocTypeInfo:x=>({label:x}),nowIso:()=> '2026-09-11T00:00:00Z',registerVerifiedInformation:o=>o,saveState:()=>false,logActivity(){},archiveImportEntry(){},renderDocumentsPage(){},renderVehicleDetail(){},renderAlertsBell(){},clearSmartImportPending(){clear++},CURRENT_VEHICLE_DETAIL_PLATE:null};
  vm.createContext(ctx); vm.runInContext(extractFunction('confirmVehicleDocumentRouting'),ctx);
  ctx.confirmVehicleDocumentRouting({sourceFile:{name:'reg.pdf',size:10,type:'application/pdf'},sourceName:'reg.pdf',kind:'vehicle_document',data:{plate:'ABC123',docType:'استمارة',expiryDate:'2027-01-01'}},null,'موثق');
  await tick(); await tick();
  if(clear!==0) throw new Error('Smart Import cleared pending item after persistence failure');
  if(!toasts.some(x=>/فشل الحفظ/.test(x))) throw new Error('Smart Import persistence failure not visible');
}
console.log('TRIAL_DATA_INTEGRITY_1141_OK',{saveRollback:true,restoreRollback:true,restoreSuccess:true,smartImportPersist:true,smartImportRetryPreserved:true});
