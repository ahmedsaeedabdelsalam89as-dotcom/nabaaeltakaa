import fs from 'node:fs';
const r=fs.readFileSync(new URL('../src-tauri/src/naba_peer.rs',import.meta.url),'utf8');
const c=fs.readFileSync(new URL('../src-tauri/Cargo.toml',import.meta.url),'utf8');
for(const x of ['DnsServiceConstructInstance','DnsServiceRegister(','DnsServiceDeRegister(','_naba-fleet._tcp.local.','unicast_enabled: 0','DNS_REQUEST_PENDING: u32 = 9506','windows_dnssd::start()','windows_dnssd::stop()']) if(!r.includes(x)) throw new Error('DNSSD_MISSING:'+x);
if(c.includes('mdns-sd')) throw new Error('EXTERNAL_MDNS_DEPENDENCY_NOT_ALLOWED');
console.log(JSON.stringify({ok:true,native:'dnsapi.dll',service:'_naba-fleet._tcp.local.',externalDependency:false,manualFallback:true}));
