(function(g){
"use strict";
const INBOX="naba_unified_inbox_windows_130", AUTO="naba_auto_lan_sync_130";
function inv(){return (g.__TAURI_INTERNALS__&&g.__TAURI_INTERNALS__.invoke)||(g.__TAURI__&&g.__TAURI__.core&&g.__TAURI__.core.invoke)||null}
function hex(bytes){return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
async function ensureToken(){const i=inv();if(!i)throw Error('TAURI_INVOKE_UNAVAILABLE');let t=await i('secure_secret_get',{name:'lan_pair_token'});if(t&&t.length>=24)return t;let b=new Uint8Array(32);crypto.getRandomValues(b);t=hex(b);await i('secure_secret_set',{name:'lan_pair_token',value:t});return t}
async function start(){const i=inv();if(!i)return {ok:false,reason:'TAURI_INVOKE_UNAVAILABLE'};try{const token=await ensureToken();const r=await i('naba_peer_start');let ip=null;try{ip=await i('naba_peer_local_ip')}catch(_){};await pullInbox();return {ok:true,token,ip,port:r.port||18765,url:ip?`http://${ip}:${r.port||18765}`:null,server:r}}catch(e){return {ok:false,error:String(e&&e.message||e)}}}
async function stop(){const i=inv();return i?i('naba_peer_stop'):false}
async function status(){const i=inv();return i?i('naba_peer_status'):{running:false}}
async function pullInbox(){const i=inv();if(!i)return {ok:false};const rows=await i('naba_peer_snapshot');let a=[];try{a=JSON.parse(localStorage.getItem(INBOX)||'[]')}catch(_){};let seen=new Set(a.map(x=>x.operationId));let added=0;for(const x of (rows||[])){if(x&&x.operationId&&!seen.has(x.operationId)){a.push(x);seen.add(x.operationId);added++}}if(a.length>10000)a=a.slice(-10000);localStorage.setItem(INBOX,JSON.stringify(a));return {ok:true,added,total:a.length}}
function inbox(){try{return JSON.parse(localStorage.getItem(INBOX)||'[]')}catch(_){return []}}
function auto(){let enabled=localStorage.getItem(AUTO)!=='0';if(enabled)setTimeout(start,1200);setInterval(()=>{if(document.visibilityState==='visible')pullInbox().catch(e=>{try{console.warn('[NABA_SYNC_PULL_FAILED]',e)}catch(_){}})},15000)}
g.NABA_WINDOWS_SYNC={version:'1.3.0',ensureToken,start,stop,status,pullInbox,inbox,setAuto:v=>localStorage.setItem(AUTO,v?'1':'0')};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',auto);else auto();
})(window);
