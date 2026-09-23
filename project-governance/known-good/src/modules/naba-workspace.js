(function(){'use strict';
  var flow, bindings=[],lastFocus;
  function q(s){return document.querySelector(s);}
  function el(tag,text,cls){var x=document.createElement(tag);if(text!=null)x.textContent=text;if(cls)x.className=cls;return x;}
  function closePalette(){var p=q('#nabaCommandPalette');p.classList.remove('open');p.setAttribute('aria-hidden','true');if(lastFocus&&lastFocus.isConnected)lastFocus.focus();}
  function openPalette(seed){lastFocus=document.activeElement;var p=q('#nabaCommandPalette'),input=q('#nabaPaletteInput');p.classList.add('open');p.setAttribute('aria-hidden','false');input.value=seed||'';bindings[0].render();input.focus();}
  function bind(input,box,palette){
    if(!input||!box)return;var items=[],selected=0,timer;
    input.setAttribute('role','combobox');input.setAttribute('aria-label','البحث في الأقسام والسجلات');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',box.id);input.setAttribute('aria-expanded','false');box.setAttribute('role','listbox');
    function mark(){Array.from(box.querySelectorAll('button')).forEach(function(b,i){b.classList.toggle('selected',i===selected);b.setAttribute('aria-selected',String(i===selected));});if(items.length){input.setAttribute('aria-activedescendant',box.id+'-'+selected);var row=box.children[selected];if(row)row.scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');}
    function hide(){box.style.display='none';input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');}
    function activate(i){clearTimeout(timer);var item=items[i];if(!item)return;if(palette)closePalette();else hide();flow.route(item.id);}
    function render(){clearTimeout(timer);box.replaceChildren();if(!palette&&!input.value.trim()){hide();return;}items=flow.search(input.value,{limit:30});selected=0;items.forEach(function(item,i){var b=el('button',null,'naba-palette-item');b.type='button';b.id=box.id+'-'+i;b.setAttribute('role','option');var text=el('span',null,'naba-palette-copy');text.append(el('b',item.label),el('small',[item.kind,item.record&&item.record.plate,item.record&&item.record.project].filter(Boolean).join(' · ')));b.append(text);b.addEventListener('click',function(){activate(i);});box.append(b);});if(!items.length)box.append(el('p','لا توجد نتائج مطابقة. جرّب اللوحة أو الاسم أو رقم المستند.','naba-action-empty'));box.style.display='block';input.setAttribute('aria-expanded','true');mark();}
    input.addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(render,60);});
    input.addEventListener('keydown',function(e){if(e.key==='Escape'){clearTimeout(timer);if(palette)closePalette();else hide();}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(timer){render();timer=null;}selected=Math.max(0,Math.min(items.length-1,selected+(e.key==='ArrowDown'?1:-1)));mark();}else if(e.key==='Enter'){e.preventDefault();if(timer){render();timer=null;}activate(selected);}});
    if(!palette)document.addEventListener('click',function(e){if(e.target!==input&&!box.contains(e.target))hide();});bindings.push({render:render,input:input,box:box,palette:palette});
  }
  function renderActionCenter(){var dash=q('#page-dashboard');if(!dash)return;var old=q('#nabaActionCenter');if(old)old.remove();var card=el('section',null,'card naba-action-center');card.id='nabaActionCenter';card.append(el('h3','متابعة العمل والانتقال المباشر'),el('p','المهام المفتوحة، بترتيب موعد الاستحقاق. افتح المهمة لعرض بياناتها وروابطها.','small-note'));var rows=(flow.collection('TASKS')||[]).filter(function(t){return !/^(done|closed|completed|cancelled|مكتمل|منتهي)$/i.test(t.status||'');}).slice().sort(function(a,b){return String(a.due_date||'9999').localeCompare(String(b.due_date||'9999'));}).slice(0,7);rows.forEach(function(r){var node=flow.find('TASKS',r.id);if(!node)return;var b=el('button',(r.title||node.label)+' · '+(r.assigned_to||'')+' · '+(r.due_date||'بدون موعد'),'btn secondary');b.type='button';b.addEventListener('click',function(){flow.route(node.id);});card.append(b);});if(!rows.length)card.append(el('p','لا توجد مهام مفتوحة مسجلة.'));var b=el('button','بحث في الأقسام والسجلات · Ctrl+K','btn primary');b.type='button';b.addEventListener('click',function(){openPalette('');});card.append(b);var title=dash.querySelector('.pagetitle');if(title)title.after(card);else dash.prepend(card);}
  function syncGroupActive(page){var map={projects:'vehicles',tracking:'vehicles',trackinglive:'vehicles',vehicleDetail:'vehicles',driverDetail:'drivers',fuel:'maintenance',fuelintel:'maintenance',purchases:'maintenance',warehouse:'maintenance',driverperf:'drivers',violations:'drivers',documents:'aiassist',verifiedinfo:'aiassist',whatsappops:'aiassist',fleetrisk:'nabaadvanced',maintpredict:'nabaadvanced',opsdecision:'nabaadvanced',dataintegrity:'nabaadvanced',opsplanning:'nabaadvanced'};document.querySelectorAll('.workspace-nav-button').forEach(function(b){b.classList.toggle('active',b.dataset.page===(map[page]||page));});}
  function init(){flow=window.NabaFlow;if(!flow)return;
    bind(q('#nabaPaletteInput'),q('#nabaPaletteResults'),true);bind(q('#globalSearch'),q('#searchResults'),false);bind(q('#dashSmartSearch'),q('#dashSmartSearchResults'),false);
    q('#nabaCommandPaletteBtn').addEventListener('click',function(){openPalette('');});document.querySelectorAll('[data-naba-close]').forEach(function(b){b.addEventListener('click',closePalette);});
    var toggle=q('#workspaceLegacyToggle');if(toggle)toggle.addEventListener('click',function(){q('#sidebar').classList.toggle('show-legacy-nav');});
    document.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPalette('');}if(e.key==='Escape'&&q('#nabaCommandPalette').classList.contains('open'))closePalette();});
    var controls=el('div',null,'nf-flow-controls'),back=el('button','رجوع','btn secondary'),status=el('span','البيانات جاهزة','small-note');status.id='nfDataStatus';status.setAttribute('role','status');back.type='button';back.addEventListener('click',function(){flow.back();});controls.append(back,status);q('header.topbar').append(controls);
    flow.subscribe(function(event){if(event.type==='commit'){status.textContent='تم تحديث البيانات';bindings.forEach(function(b){if(b.box.style.display!=='none'&&(!b.palette||q('#nabaCommandPalette').classList.contains('open')))b.render();});}if(event.type==='navigate'){syncGroupActive(event.page);if(event.page==='dashboard')renderActionCenter();}});
    window.NabaWorkspace={version:'1.14.0',open:openPalette,renderActionCenter:renderActionCenter,showContext:function(){}};renderActionCenter();syncGroupActive('dashboard');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* NABA UOM + Workflow additive layer — 2026-09-10 — READ ONLY over operational stores */
(function(){'use strict';
  var VERSION='1.10.6+uom.3', CACHE_KEY='NABA_UOM_DECISION_CACHE_V1', WF_KEY='NABA_UOM_WORKFLOWS_V1';
  function obj(v){return v&&typeof v==='object'?v:{}}
  function arr(v){return Array.isArray(v)?v:[]}
  function txt(v){return String(v==null?'':v).trim()}
  function norm(v){return txt(v).toLowerCase().replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[\s\-_\/]+/g,'')}
  function app(){return obj(window.APP)}
  function call(name){try{return typeof window[name]==='function'?window[name]():null}catch(_){return null}}
  function rows(type){var A=app(),r;
    if(type==='vehicle')return arr(A.FLEET);
    if(type==='driver')return arr(A.DRIVERS);
    if(type==='approved_driver')return arr(A.DRIVERS).filter(function(d){return d&&d.hr_approved===true});
    if(type==='document')return arr(A.DOCUMENTS_LIBRARY||A.VEHICLE_DOCUMENTS||A.DOCUMENTS);
    if(type==='maintenance'){r=call('computeMaintenanceTracking');return arr(r&&r.rows||r||A.MAINTENANCE)}
    if(type==='fault_report')return arr(A.FAULT_REPORTS);
    if(type==='fuel'){r=call('computeFuelIntelligence');return arr(r&&r.rows||r||A.FUEL)}
    if(type==='workflow'){try{return arr(JSON.parse(localStorage.getItem(WF_KEY)||'[]'))}catch(_){return []}}
    if(type==='violation')return arr(A.VIOLATIONS);
    if(type==='tracking')return arr(A.TRACKING);
    if(type==='source_document')return arr(A.SOURCE_DOCUMENT_CATALOG);
    if(type==='audit_log')return arr(A.DOCUMENT_AUDIT_LOG);
    if(type==='finding')return arr(A.DATA_INTEGRITY_FINDINGS);
    if(type==='company')return arr(A.COMPANY_REGISTRY);
    return [];
  }
  var schemas={
    vehicle:{label:'مركبة',source:'APP.FLEET',key:'plate',mutable:false},
    driver:{label:'سائق',source:'APP.DRIVERS',key:'name',mutable:false},
    approved_driver:{label:'سائق معتمد',source:'APP.DRIVERS[hr_approved=true]',key:'name',mutable:false},
    document:{label:'مستند مركبة',source:'documents store',key:'id',mutable:false},
    maintenance:{label:'صيانة',source:'maintenance engine',key:'plate',mutable:false},
    fault_report:{label:'بلاغ عطل',source:'APP.FAULT_REPORTS',key:'plate',mutable:false},
    fuel:{label:'وقود',source:'fuel intelligence',key:'plate',mutable:false},
    workflow:{label:'سير عمل',source:WF_KEY,key:'id',mutable:false},
    violation:{label:'مخالفة',source:'APP.VIOLATIONS',key:'plate',mutable:false},
    tracking:{label:'تتبع',source:'APP.TRACKING',key:'plate',mutable:false},
    source_document:{label:'مستند مصدري (ملف خام)',source:'APP.SOURCE_DOCUMENT_CATALOG',key:'id',mutable:false},
    audit_log:{label:'سجل تدقيق مستندات',source:'APP.DOCUMENT_AUDIT_LOG',key:'id',mutable:false},
    finding:{label:'ملاحظة تكامل بيانات',source:'APP.DATA_INTEGRITY_FINDINGS',key:'plate',mutable:false},
    company:{label:'جهة/شركة',source:'APP.COMPANY_REGISTRY',key:'company_id',mutable:false}
  };
  function schemaList(){return Object.keys(schemas).map(function(k){return Object.assign({type:k},schemas[k])})}
  function keyOf(type,x){var k=(schemas[type]&&schemas[type].key)||'id';return txt(x&&x[k]||x&&x.id||x&&x.plate||x&&x.name)}
  function get(type,id){var n=norm(id),r=rows(type).find(function(x){return norm(keyOf(type,x))===n});return r||null}
  function query(type,filter,limit){var out=rows(type),f=obj(filter);Object.keys(f).forEach(function(k){out=out.filter(function(x){return norm(x&&x[k]).indexOf(norm(f[k]))>=0})});return out.slice(0,Math.max(1,Math.min(Number(limit)||100,500)))}
  function byPlate(list,plate){var n=norm(plate);return arr(list).filter(function(x){return norm(x&&(x.plate||x.plate_no||x.vehicle_plate))===n})}
  function companyOf(name){var n=norm(name);if(!n)return null;return rows('company').find(function(c){return norm(c.legal_name)===n||n.indexOf(norm(c.legal_name))>=0||norm(c.legal_name).indexOf(n)>=0})||null}
  function relations(type,id){if(type!=='vehicle')return {};var v=get('vehicle',id);if(!v)return {};var plate=keyOf('vehicle',v),driverName=txt(v.driver||v.driver_name);return {vehicle:v,driver:driverName?get('driver',driverName):null,driverApproved:driverName?!!get('approved_driver',driverName):false,documents:byPlate(rows('document'),plate),maintenance:byPlate(rows('maintenance'),plate),faultReports:byPlate(rows('fault_report'),plate),fuel:byPlate(rows('fuel'),plate),violations:byPlate(rows('violation'),plate),tracking:byPlate(rows('tracking'),plate),sourceDocuments:byPlate(rows('source_document'),plate),auditLog:byPlate(rows('audit_log'),plate),findings:byPlate(rows('finding'),plate),ownerCompany:companyOf(v.owner_company),operatorCompany:companyOf(v.operator_company)}}
  function entity360(plate){return relations('vehicle',plate)}
  function loadWorkflows(){return rows('workflow')}
  function saveWorkflows(x){try{localStorage.setItem(WF_KEY,JSON.stringify(arr(x).slice(-300)));return {ok:true}}catch(e){var msg='NABA_WORKFLOW_STORAGE_WRITE_FAILED:'+String(e&&e.message||e);try{console.error(msg,e)}catch(_){}return {ok:false,error:msg}}}
  function createWorkflow(type,input){var all=loadWorkflows(),wf={id:'wf_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),type:txt(type)||'generic',input:obj(input),status:'queued',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),source:'naba-uom'};all.push(wf);var persisted=saveWorkflows(all);if(!persisted.ok)return {ok:false,error:persisted.error,workflow:null};return {ok:true,workflow:wf}}
  function workflowStatus(id){var w=loadWorkflows().find(function(x){return x.id===id});return w?{ok:true,workflow:w}:{ok:false,error:'Workflow غير موجود'}}
  function refreshWorkflows(){var a=loadWorkflows();return {ok:true,total:a.length,recent:a.slice(-20).reverse()}}
  function safeOperationalDecisions(force){var now=Date.now(),ttl=60000,c=null;try{c=JSON.parse(sessionStorage.getItem(CACHE_KEY)||'null')}catch(_){}if(!force&&c&&now-c.at<ttl)return c.value;var fn=window.computeOperationalDecisionEngine||window.computeFleetDecisions||window.computeSystemAlerts;if(typeof fn!=='function')return null;try{var value=fn();try{sessionStorage.setItem(CACHE_KEY,JSON.stringify({at:now,value:value}))}catch(_){}return value}catch(_){return c&&c.value||null}}
  function health(){var A=app(),checks=[['APP',!!window.APP],['FLEET',Array.isArray(A.FLEET)],['DRIVERS',Array.isArray(A.DRIVERS)],['workspace',!!window.NabaWorkspace]];return {ok:checks.every(function(x){return x[1]}),version:VERSION,checks:checks.map(function(x){return {name:x[0],ok:x[1]}}),counts:{vehicles:arr(A.FLEET).length,drivers:arr(A.DRIVERS).length,approvedDrivers:arr(A.DRIVERS).filter(function(d){return d&&d.hr_approved===true}).length,sourceDocuments:arr(A.SOURCE_DOCUMENT_CATALOG).length,auditLog:arr(A.DOCUMENT_AUDIT_LOG).length,findings:arr(A.DATA_INTEGRITY_FINDINGS).length,companies:arr(A.COMPANY_REGISTRY).length},at:new Date().toISOString()}}
  function install(){var ai=window.NabaFleetAI=window.NabaFleetAI||{};if(!ai.objectSchemas)ai.objectSchemas=schemaList;if(!ai.objectGet)ai.objectGet=get;if(!ai.objectQuery)ai.objectQuery=query;if(!ai.objectRelations)ai.objectRelations=relations;if(!ai.objectModelVersion)ai.objectModelVersion=VERSION;if(!ai.entity360)ai.entity360=entity360;if(!ai.createWorkflow)ai.createWorkflow=createWorkflow;if(!ai.workflowStatus)ai.workflowStatus=workflowStatus;if(!ai.refreshWorkflows)ai.refreshWorkflows=refreshWorkflows;if(!ai.safeOperationalDecisions)ai.safeOperationalDecisions=safeOperationalDecisions;if(!ai.uomHealthCheck)ai.uomHealthCheck=health;window.NabaUOMWorkflow={version:VERSION,schemas:schemaList,get:get,query:query,relations:relations,entity360:entity360,createWorkflow:createWorkflow,workflowStatus:workflowStatus,refreshWorkflows:refreshWorkflows,healthCheck:health};}
  install();
})();
