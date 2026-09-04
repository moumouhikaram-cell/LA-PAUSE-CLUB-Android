'use strict';
const fs=require('fs');
const crypto=require('crypto');

const b64=String(process.env.LA_PAUSE_BOOTSTRAP_ENTITLEMENT_B64||'').trim();
const keyId=String(process.env.LA_PAUSE_ENTITLEMENT_KEY_ID||'prod-v1').trim();
const pubPath=process.argv[2]||'../contracts/security/entitlement-prod-v1-public.der.b64';
if(!b64)throw new Error('LA_PAUSE_BOOTSTRAP_ENTITLEMENT_B64 is required');

const decodeBase64=text=>Buffer.from(String(text).replace(/\s+/g,''),'base64');
const canonical=value=>{
  if(value===null)return 'null';
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  if(typeof value==='number'){if(!Number.isFinite(value))throw new Error('non-finite entitlement number');return Object.is(value,-0)?'0':JSON.stringify(value)}
  if(typeof value==='boolean')return value?'true':'false';
  if(typeof value==='string')return JSON.stringify(value);
  throw new Error(`unsupported entitlement value: ${typeof value}`);
};
const required=['schemaVersion','entitlementId','catalogVersion','tenantId','status','modules','features','limits','issuedAt','periodStart','periodEnd','offlineValidUntil','keyId','algorithm','signature'];
const raw=decodeBase64(b64).toString('utf8');
const ent=JSON.parse(raw);
for(const k of required)if(ent[k]===undefined||ent[k]===null)throw new Error(`bootstrap entitlement missing ${k}`);
if(ent.schemaVersion!==1)throw new Error('bootstrap schemaVersion must be 1');
if(ent.algorithm!=='ECDSA_P256_SHA256')throw new Error('bootstrap algorithm mismatch');
if(String(ent.keyId)!==keyId)throw new Error('bootstrap keyId mismatch');
if(!Array.isArray(ent.modules)||!Array.isArray(ent.features)||!ent.limits||typeof ent.limits!=='object')throw new Error('bootstrap module/feature/limits structure invalid');
if(!(Number(ent.issuedAt)>0&&Number(ent.periodStart)>0&&Number(ent.periodEnd)>=Number(ent.periodStart)&&Number(ent.offlineValidUntil)>0))throw new Error('bootstrap entitlement timestamps invalid');

const signatureText=String(ent.signature||'').trim();
const unsigned={...ent};delete unsigned.signature;
const pubB64=fs.readFileSync(pubPath,'utf8').replace(/\s+/g,'');
if(!pubB64)throw new Error('pinned entitlement public key missing');
const publicKey=crypto.createPublicKey({key:Buffer.from(pubB64,'base64'),format:'der',type:'spki'});
const normalizedSig=signatureText.replace(/-/g,'+').replace(/_/g,'/');
const pad='='.repeat((4-normalizedSig.length%4)%4);
const signature=Buffer.from(normalizedSig+pad,'base64');
const valid=crypto.verify('sha256',Buffer.from(canonical(unsigned),'utf8'),publicKey,signature);
if(!valid)throw new Error('bootstrap entitlement signature invalid');

console.log('BOOTSTRAP_ENTITLEMENT_SIGNATURE_OK');
console.log(`BOOTSTRAP_ENTITLEMENT_KID_OK ${keyId}`);
console.log(`BOOTSTRAP_ENTITLEMENT_OFFLINE_UNTIL_OK ${Number(ent.offlineValidUntil)}`);
