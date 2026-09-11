import fs from 'node:fs';
const html=fs.readFileSync('src/index.html','utf8');
const win=fs.readFileSync('src/modules/naba-windows-sync.js','utf8');
const core=fs.readFileSync('src/modules/naba-unified-sync.js','utf8');
const peer=fs.readFileSync('src-tauri/src/naba_peer.rs','utf8');
const lib=fs.readFileSync('src-tauri/src/lib.rs','utf8');
const checks={
 sharedScripts:['naba-unified-sync.js','naba-peer-protocol.js','schema-gate.js','naba-windows-sync.js'].every(x=>html.includes(x)),
 coreEnvelope:['operationId','deviceId','revision','updatedAt'].every(x=>core.includes(x)),
 inbox:win.includes('naba_unified_inbox_windows_130')&&win.includes('naba_peer_snapshot'),
 securePair:win.includes("secure_secret_get")&&lib.includes('lan_pair_token'),
 peerServer:peer.includes('TcpListener::bind')&&peer.includes('NABA-PEER/1.3'),
 peerAuth:peer.includes('x-naba-token')&&peer.includes('401 Unauthorized'),
 conflict:peer.includes('409 Conflict'),
 persistence:peer.includes('peer_state.json')&&peer.includes('fs::rename'),
 cors:peer.includes('OPTIONS')&&peer.includes('Access-Control-Allow-Headers'),
 registered:['naba_peer_start','naba_peer_stop','naba_peer_status','naba_peer_snapshot','naba_peer_local_ip'].every(x=>lib.includes(x))
};
for(const [k,v] of Object.entries(checks))if(!v)throw new Error('UNIFIED_SYNC_FAIL '+k);
console.log('UNIFIED_SYNC_SMOKE_OK',checks);
