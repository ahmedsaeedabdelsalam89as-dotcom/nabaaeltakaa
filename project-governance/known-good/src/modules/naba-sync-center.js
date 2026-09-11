(function(g){
"use strict";
const ID="naba-sync-center-112";
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function api(){return g.NABA_WINDOWS_SYNC||null}
function copy(text){
  if(!text)return Promise.resolve(false);
  if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(text).then(()=>true).catch(()=>false);
  try{const t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();const ok=document.execCommand('copy');t.remove();return Promise.resolve(!!ok)}catch(_){return Promise.resolve(false)}
}
function shell(){
 if(document.getElementById(ID))return;
 const root=document.createElement('div'); root.id=ID; root.dir='rtl';
 root.innerHTML=`<div class="nsc-panel" role="dialog" aria-label="مركز مزامنة NABA">
   <div class="nsc-head"><span>مركز مزامنة NABA</span><button type="button" class="nsc-act" data-a="close" aria-label="إغلاق">✕</button></div>
   <div class="nsc-body">
    <div class="nsc-row"><span class="nsc-k">الحالة</span><span class="nsc-status" data-v="status">جاري الفحص…</span></div>
    <div class="nsc-row"><span class="nsc-k">عنوان الكمبيوتر على الشبكة</span><span data-v="url">—</span></div>
    <div class="nsc-row"><span class="nsc-k">Auto‑Discovery</span><span data-v="discovery">—</span></div>
    <div class="nsc-row"><span class="nsc-k">Pair Token</span><span class="nsc-token" data-v="token">••••••••••••••••</span></div>
    <div class="nsc-actions">
      <button type="button" class="nsc-act" data-a="refresh">تحديث الحالة</button><button type="button" class="nsc-act" data-a="copy-url">نسخ العنوان</button>
      <button type="button" class="nsc-act" data-a="copy-token">نسخ Pair Token</button><button type="button" class="nsc-act" data-a="toggle-token">إظهار/إخفاء الرمز</button>
    </div>
   </div>
 </div><button type="button" class="nsc-btn" data-a="open">⇄ مزامنة</button>`;
 document.body.appendChild(root);
 let last={token:'',url:'',discovery:false,running:false}; let reveal=false;
 const set=(k,v)=>{const n=root.querySelector(`[data-v="${k}"]`);if(n)n.textContent=v};
 async function refresh(){
   const a=api(); if(!a){set('status','غير متاح خارج تطبيق Windows');root.querySelector('[data-v="status"]').dataset.ok='0';return}
   set('status','جاري الفحص…');
   try{
     const r=await a.start(); const s=await a.status();
     last={token:r&&r.token||'',url:r&&r.url||'',discovery:!!(r&&r.server&&r.server.autoDiscovery),running:!!(s&&s.running)};
     set('status',last.running?'LAN Peer يعمل':'LAN Peer متوقف'); root.querySelector('[data-v="status"]').dataset.ok=last.running?'1':'0';
     set('url',last.url||'تعذر تحديد العنوان'); set('discovery',last.discovery?'يعمل تلقائيًا':'Pairing يدوي متاح');
     set('token',reveal?(last.token||'—'):(last.token?'••••••••••••••••':'—'));
   }catch(e){set('status','تعذر تشغيل المزامنة: '+String(e&&e.message||e));root.querySelector('[data-v="status"]').dataset.ok='0'}
 }
 root.addEventListener('click',async ev=>{const b=ev.target.closest('[data-a]');if(!b)return;const a=b.dataset.a;
   if(a==='open'){root.classList.add('open');await refresh()} else if(a==='close')root.classList.remove('open');
   else if(a==='refresh')await refresh(); else if(a==='copy-url'){await copy(last.url);}
   else if(a==='copy-token'){await copy(last.token);} else if(a==='toggle-token'){reveal=!reveal;set('token',reveal?(last.token||'—'):(last.token?'••••••••••••••••':'—'));}
 });
 g.NABA_SYNC_CENTER={refresh,version:'1.13.13'};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',shell);else shell();
})(window);
