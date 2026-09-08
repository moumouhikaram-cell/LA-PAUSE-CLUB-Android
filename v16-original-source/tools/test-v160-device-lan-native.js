'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../app/src/main/java/com/lapauseclub/manager');
const bridge=fs.readFileSync(path.join(root,'DeviceLanBridge.java'),'utf8');
const main=fs.readFileSync(path.join(root,'MainActivity.java'),'utf8');
function ok(v,msg){if(!v)throw new Error(msg)}

ok(/AndroidKeyStore/.test(bridge),'Device secret store must use AndroidKeyStore');
ok(/AES\/GCM\/NoPadding/.test(bridge),'Device secret store must use AES-GCM');
ok(/\^device-auth-/.test(bridge)&&/KEY_PREFIX = "device-auth-"/.test(bridge),'Device secret namespace is not restricted');
ok(/new int\[\]\{8080, 8765, 3000\}/.test(bridge),'LAN scanner ports drifted from protocol');
ok(/\/health/.test(bridge),'LAN scanner does not probe /health');
ok(/LA_PAUSE_DEVICE_AGENT_V1/.test(bridge)&&/LA_PAUSE_DEVICE_AGENT/.test(bridge)&&/X-LA-PAUSE-Agent/.test(bridge),'Explicit LA PAUSE identity markers missing');
ok(/isSiteLocalAddress\(\)/.test(bridge)&&/isLinkLocalAddress\(\)/.test(bridge),'Scanner is not restricted to a private/link-local interface');
ok(/prefix \+ "0\/24"/.test(bridge),'Scanner no longer declares the current /24 scope');
ok(/agentId\.isEmpty\(\)/.test(bridge),'Scanner accepts agents without stable agentId');
ok(!/https?:\/\/8\.8\.8\.8/.test(bridge),'Public test endpoint accidentally embedded');
// Detect actual forbidden dependencies/references, not explanatory comments containing the words.
ok(!/import\s+.*(?:Entitlement|Saas|Workspace)/i.test(bridge)
   && !/com\.lapauseclub\.manager\.security\./.test(bridge)
   && !/\b(?:CoreSaasSchemaP5|EntitlementStore|EntitlementVerifier|AppIntegrity|WorkspaceStore)\b/.test(bridge),
   'DeviceLanBridge imported forbidden SaaS/entitlement scope');

ok(/private DeviceLanBridge deviceLanBridge;/.test(main),'MainActivity does not own isolated DeviceLanBridge');
ok(/new DeviceLanBridge\(getApplicationContext\(\)\)/.test(main),'DeviceLanBridge not initialized');
ok(/public boolean setSecureValue\(String key, String value\)/.test(main),'Secure write JS bridge missing');
ok(/public String getSecureValue\(String key\)/.test(main),'Secure read JS bridge missing');
ok(/public boolean deleteSecureValue\(String key\)/.test(main),'Secure delete JS bridge missing');
ok(/public void discoverLaPauseAgents\(String requestId\)/.test(main),'Native LA PAUSE discovery JS bridge missing');
ok(/window\.onLaPauseLanDiscovery/.test(main),'Native discovery callback missing');
ok(!/ACCESS_FINE_LOCATION|ACCESS_COARSE_LOCATION/.test(main),'LAN scanner unexpectedly asks for location permissions');
console.log('V160_DEVICE_KEYSTORE_AES_GCM_OK');
console.log('V160_DEVICE_SECRET_NAMESPACE_OK');
console.log('V160_DEVICE_LAN_ONLY_24_OK');
console.log('V160_DEVICE_PROTOCOL_IDENTITY_NATIVE_OK');
console.log('V160_DEVICE_NATIVE_JS_BRIDGE_OK');
console.log('V160_DEVICE_NO_SAAS_DEPENDENCY_OK');
console.log('V160_DEVICE_LAN_NATIVE_GATE_OK');
