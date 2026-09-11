/* NABA Local Peer Protocol 1.3.0 — shared transport contract */
(function(g){
"use strict";
const P="NABA-PEER/1.3";
function envelope(type,payload,deviceId){
 return {protocol:P,messageId:(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random()),type,payload,deviceId,createdAt:new Date().toISOString()};
}
function validate(m){
 return !!m && m.protocol===P && typeof m.messageId==="string" &&
 ["hello","pull","push","ack","conflict"].includes(m.type) && typeof m.deviceId==="string";
}
function dedupe(cache,m){if(cache.has(m.messageId))return false;cache.add(m.messageId);if(cache.size>5000){let x=cache.values().next().value;cache.delete(x)}return true}
g.NABA_PEER={protocol:P,envelope,validate,dedupe};
})(window);