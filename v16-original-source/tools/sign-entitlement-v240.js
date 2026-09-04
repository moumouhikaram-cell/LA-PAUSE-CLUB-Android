'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const ALGORITHM='ECDSA_P256_SHA256';
const DEFAULT_CATALOG=path.join(__dirname,'..','..','contracts','saas','module-catalog.v1.json');
const ALLOWED_KEYS=new Set([
  'schemaVersion','entitlementId','catalogVersion','tenantId','venueIds','branchIds','status','modules','features','limits',
  'deviceBindings','issuedAt','periodStart','periodEnd','offlineValidUntil','revocationEpoch','keyId','algorithm','signature'
]);
const REQUIRED_KEYS=['schemaVersion','entitlementId','catalogVersion','tenantId','status','modules','features','limits','issuedAt','periodStart','periodEnd','offlineValidUntil','keyId','algorithm'];

function canonical(value){
  if(value===null)return 'null';
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw new Error('non-finite entitlement number');
    return Object.is(value,-0)?'0':JSON.stringify(value);
  }
  if(typeof value==='boolean')return value?'true':'false';
  if(typeof value==='string')return JSON.stringify(value);
  throw new Error(`unsupported entitlement value: ${typeof value}`);
}

function uniqueStrings(value,name){
  if(!Array.isArray(value))throw new Error(`${name} must be an array`);
  const out=value.map(v=>String(v));
  if(out.some(v=>!v.trim()))throw new Error(`${name} contains an empty value`);
  if(new Set(out).size!==out.length)throw new Error(`${name} contains duplicates`);
  return out;
}

function validate(ent,catalog){
  if(!ent||typeof ent!=='object'||Array.isArray(ent))throw new Error('entitlement must be an object');
  for(const key of Object.keys(ent))if(!ALLOWED_KEYS.has(key))throw new Error(`unsupported entitlement field: ${key}`);
  for(const key of REQUIRED_KEYS)if(ent[key]===undefined||ent[key]===null)throw new Error(`entitlement missing ${key}`);
  if(ent.signature!==undefined)throw new Error('input entitlement must be unsigned');
  if(ent.schemaVersion!==1)throw new Error('schemaVersion must be 1');
  if(String(ent.entitlementId).trim().length<8)throw new Error('entitlementId must be at least 8 characters');
  if(!String(ent.tenantId).trim())throw new Error('tenantId is required');
  if(ent.algorithm!==ALGORITHM)throw new Error(`algorithm must be ${ALGORITHM}`);
  if(!String(ent.keyId).trim())throw new Error('keyId is required');
  if(catalog&&ent.catalogVersion!==catalog.catalogVersion)throw new Error(`catalogVersion mismatch: expected ${catalog.catalogVersion}`);
  const moduleIds=uniqueStrings(ent.modules,'modules');
  uniqueStrings(ent.features,'features');
  uniqueStrings(ent.venueIds||[],'venueIds');
  uniqueStrings(ent.branchIds||[],'branchIds');
  uniqueStrings(ent.deviceBindings||[],'deviceBindings');
  if(!ent.limits||typeof ent.limits!=='object'||Array.isArray(ent.limits))throw new Error('limits must be an object');
  const validStatus=new Set(['ACTIVE','TRIAL','PAST_DUE_GRACE','SUSPENDED','EXPIRED','REVOKED']);
  if(!validStatus.has(ent.status))throw new Error(`unsupported status: ${ent.status}`);
  const issuedAt=Number(ent.issuedAt),start=Number(ent.periodStart),end=Number(ent.periodEnd),offline=Number(ent.offlineValidUntil);
  if(!Number.isSafeInteger(issuedAt)||issuedAt<=0)throw new Error('issuedAt must be a positive integer');
  if(!Number.isSafeInteger(start)||start<=0)throw new Error('periodStart must be a positive integer');
  if(!Number.isSafeInteger(end)||end<start)throw new Error('periodEnd must be >= periodStart');
  if(!Number.isSafeInteger(offline)||offline<=0)throw new Error('offlineValidUntil must be a positive integer');
  if(ent.revocationEpoch!==undefined&&(!Number.isSafeInteger(ent.revocationEpoch)||ent.revocationEpoch<0))throw new Error('revocationEpoch must be a non-negative integer');
  if(catalog){
    const known=new Map((catalog.modules||[]).map(m=>[m.id,m]));
    for(const id of moduleIds){
      const mod=known.get(id);
      if(!mod)throw new Error(`unknown module: ${id}`);
      for(const dep of mod.dependencies||[])if(!moduleIds.includes(dep))throw new Error(`module ${id} requires ${dep}`);
    }
  }
  return ent;
}

function loadPrivateKey(env=process.env){
  const pem=String(env.LA_PAUSE_ENTITLEMENT_PRIVATE_KEY_PEM||'').trim();
  const b64=String(env.LA_PAUSE_ENTITLEMENT_PRIVATE_KEY_B64||'').trim();
  const file=String(env.LA_PAUSE_ENTITLEMENT_PRIVATE_KEY_FILE||'').trim();
  const sources=[pem?1:0,b64?1:0,file?1:0].reduce((a,b)=>a+b,0);
  if(sources!==1)throw new Error('configure exactly one entitlement private-key source');
  let key;
  if(pem)key=crypto.createPrivateKey(pem);
  else if(file)key=crypto.createPrivateKey(fs.readFileSync(file));
  else key=crypto.createPrivateKey({key:Buffer.from(b64,'base64'),format:'der',type:'pkcs8'});
  if(key.asymmetricKeyType!=='ec')throw new Error('entitlement private key must be EC');
  const curve=key.asymmetricKeyDetails&&key.asymmetricKeyDetails.namedCurve;
  if(curve&&curve!=='prime256v1'&&curve!=='P-256')throw new Error(`entitlement private key must use P-256, got ${curve}`);
  return key;
}

function signEntitlement(unsigned,privateKey,catalog){
  const ent=validate(JSON.parse(JSON.stringify(unsigned)),catalog);
  const canonicalPayload=canonical(ent);
  const signature=crypto.sign('sha256',Buffer.from(canonicalPayload,'utf8'),privateKey);
  const publicKey=crypto.createPublicKey(privateKey);
  if(!crypto.verify('sha256',Buffer.from(canonicalPayload,'utf8'),publicKey,signature))throw new Error('self-verification failed');
  const signed={...ent,signature:signature.toString('base64url')};
  const publicDer=publicKey.export({format:'der',type:'spki'});
  return {signed,canonicalPayload,publicKeyB64:publicDer.toString('base64'),publicKeySha256:crypto.createHash('sha256').update(publicDer).digest('hex')};
}

function main(){
  const input=process.argv[2],output=process.argv[3],b64Output=process.argv[4]||'';
  if(!input||!output)throw new Error('usage: node tools/sign-entitlement-v240.js <unsigned.json> <signed.json> [signed.b64]');
  const catalogPath=process.env.LA_PAUSE_MODULE_CATALOG_FILE||DEFAULT_CATALOG;
  const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
  const unsigned=JSON.parse(fs.readFileSync(input,'utf8'));
  const expectedKeyId=String(process.env.LA_PAUSE_ENTITLEMENT_KEY_ID||'').trim();
  if(expectedKeyId&&String(unsigned.keyId||'')!==expectedKeyId)throw new Error(`keyId mismatch: expected ${expectedKeyId}`);
  const result=signEntitlement(unsigned,loadPrivateKey(),catalog);
  fs.writeFileSync(output,JSON.stringify(result.signed,null,2)+'\n',{mode:0o600});
  if(b64Output)fs.writeFileSync(b64Output,Buffer.from(JSON.stringify(result.signed),'utf8').toString('base64')+'\n',{mode:0o600});
  console.log('ENTITLEMENT_SIGNED_OK');
  console.log(`ENTITLEMENT_KEY_ID_OK ${result.signed.keyId}`);
  console.log(`ENTITLEMENT_CATALOG_OK ${result.signed.catalogVersion}`);
  console.log(`ENTITLEMENT_PUBLIC_KEY_SHA256 ${result.publicKeySha256}`);
}

if(require.main===module){
  try{main()}catch(err){console.error(`ENTITLEMENT_SIGN_ERROR ${String(err&&err.message||err)}`);process.exit(1)}
}

module.exports={ALGORITHM,canonical,validate,loadPrivateKey,signEntitlement};
