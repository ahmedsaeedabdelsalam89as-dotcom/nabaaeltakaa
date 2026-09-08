import fs from 'node:fs';
function assert(ok,msg){if(!ok) throw new Error(msg)}
const manifest=fs.readFileSync(new URL('../phone-bridge-android/app/src/main/AndroidManifest.xml', import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../phone-bridge-android/app/src/main/java/com/nabaaltaqah/phonebridge/MainActivity.kt', import.meta.url),'utf8');
const service=fs.readFileSync(new URL('../phone-bridge-android/app/src/main/java/com/nabaaltaqah/phonebridge/BridgeService.kt', import.meta.url),'utf8');
assert(manifest.includes('FOREGROUND_SERVICE_CONNECTED_DEVICE'),'connected-device FGS permission missing');
assert(manifest.includes('CHANGE_NETWORK_STATE'),'API34+ connected-device prerequisite missing');
assert(manifest.includes('ACCESS_NETWORK_STATE'),'network state permission missing');
assert(!manifest.includes('BLUETOOTH_CONNECT'),'unused dangerous Bluetooth permission retained');
assert(!manifest.includes('android:usesCleartextTraffic="true"'),'unnecessary Android cleartext traffic is enabled');
assert(manifest.includes('android:allowBackup="false"'),'Android app backup must be disabled for local bridge secrets');
assert(main.includes('ConnectivityManager'),'modern network IP path missing');
assert(!main.includes('WifiManager') && !main.includes('connectionInfo'),'deprecated WifiManager.connectionInfo still used');
assert(service.includes('POST /v1/command HTTP/1.1') && service.includes('unsupported request target'),'bridge HTTP method/path guard missing');
assert(service.includes('data.size > 16_384'),'encrypted payload bound missing');
console.log('ANDROID_STATIC_OK');
