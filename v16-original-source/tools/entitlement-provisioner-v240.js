'use strict';
const fs=require('fs');
const os=require('os');
const path=require('path');
const assert=require('assert');
const crypto=require('crypto');
const cp=require('child_process');
const signer=require('./sign-entitlement-v240');

const root=path.join(__dirname,'..','..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'contracts','saas','module-catalog.v1.json'),'utf8'));
const pair=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const publicDer=pair.publicKey.export({format:'der',type:'spki'});
const privateDer=pair.privateKey.export({format:'der',type:'pkcs8'});
const now=Date.now();
const base={
  schemaVersion:1,
  entitlementId:'ent-ci-ephemeral-v240',
  catalogVersion:catalog.catalogVersion,
  tenantId:'tenant-ci',
  venueIds:['venue-ci'],
  branchIds:['branch-ci'],
  status:'ACTIVE',
  modules:['M01_OPERATIONS','M02_POS','M05_CRM','M06_MARKETING','M09_DEVICE_CONTROL','M15_AI_OPERATOR'],
  features:['OFFLINE_CORE','NEXT_BEST_ACTION'],
  limits:{venues:1,branches:1,devices:10},
  deviceBindings:['device-ci'],
  issuedAt:now,
  periodStart:now,
  periodEnd:now+30*24*60*60*1000,
  offlineValidUntil:now+7*24*60*60*1000,
  revocationEpoch:1,
  keyId:'ci-ephemeral-v240',
  algorithm:'ECDSA_P256_SHA256'
};

const direct=signer.signEntitlement(base,pair.privateKey,catalog);
assert.ok(direct.signed.signature.length>=20,'signature missing');
assert.ok(!direct.signed.signature.includes('='),'signature should be base64url without padding');
const unsigned={...direct.signed};delete unsigned.signature;
const canonical=signer.canonical(unsigned);
assert.strictEqual(canonical,direct.canonicalPayload,'canonical payload drift');
assert.ok(crypto.verify('sha256',Buffer.from(canonical),pair.publicKey,Buffer.from(direct.signed.signature,'base64url')),'signature should verify');
const tampered={...unsigned,tenantId:'tenant-evil'};
assert.ok(!crypto.verify('sha256',Buffer.from(signer.canonical(tampered)),pair.publicKey,Buffer.from(direct.signed.signature,'base64url')),'tampering must invalidate signature');

assert.throws(()=>signer.validate({...base,modules:['M06_MARKETING']},catalog),/requires M05_CRM/);
assert.throws(()=>signer.validate({...base,modules:['M99_UNKNOWN']},catalog),/unknown module/);
assert.throws(()=>signer.validate({...base,deviceBindings:['dup','dup']},catalog),/duplicates/);
assert.throws(()=>signer.validate({...base,rogueField:true},catalog),/unsupported entitlement field/);
assert.throws(()=>signer.loadPrivateKey({LA_PAUSE_ENTITLEMENT_PRIVATE_KEY_B64:privateDer.toString('base64'),LA_PAUSE_ENTITLEMENT_PRIVATE_KEY_PEM:pair.privateKey.export({format:'pem',type:'pkcs8'})}),/exactly one/);

const fromB64=signer.loadPrivateKey({LA_PAUSE_ENTITLEMENT_PRIVATE_KEY_B64:privateDer.toString('base64')});
assert.strictEqual(crypto.createPublicKey(fromB64).export({format:'der',type:'spki'}).toString('base64'),publicDer.toString('base64'),'PKCS8 loader mismatch');

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lp-entitlement-ci-'));
try{
  const input=path.join(tmp,'unsigned.json');
  const output=path.join(tmp,'signed.json');
  const outputB64=path.join(tmp,'signed.b64');
  fs.writeFileSync(input,JSON.stringify(base));
  const env={...process.env,LA_PAUSE_ENTITLEMENT_PRIVATE_KEY_B64:privateDer.toString('base64'),LA_PAUSE_ENTITLEMENT_KEY_ID:base.keyId};
  const run=cp.spawnSync(process.execPath,[path.join(__dirname,'sign-entitlement-v240.js'),input,output,outputB64],{env,encoding:'utf8'});
  assert.strictEqual(run.status,0,`CLI failed: ${run.stderr}`);
  assert.match(run.stdout,/ENTITLEMENT_SIGNED_OK/);
  assert.match(run.stdout,/ENTITLEMENT_KEY_ID_OK ci-ephemeral-v240/);
  assert.ok(!run.stdout.includes(privateDer.toString('base64').slice(0,32)),'private key leaked to stdout');
  assert.ok(!run.stderr.includes(privateDer.toString('base64').slice(0,32)),'private key leaked to stderr');
  const signed=JSON.parse(fs.readFileSync(output,'utf8'));
  const unsignedCli={...signed};delete unsignedCli.signature;
  assert.ok(crypto.verify('sha256',Buffer.from(signer.canonical(unsignedCli)),pair.publicKey,Buffer.from(signed.signature,'base64url')),'CLI signature invalid');
  const encoded=fs.readFileSync(outputB64,'utf8').trim();
  assert.deepStrictEqual(JSON.parse(Buffer.from(encoded,'base64').toString('utf8')),signed,'bootstrap base64 output mismatch');
  const wrong=cp.spawnSync(process.execPath,[path.join(__dirname,'sign-entitlement-v240.js'),input,output],{env:{...env,LA_PAUSE_ENTITLEMENT_KEY_ID:'wrong-key'},encoding:'utf8'});
  assert.notStrictEqual(wrong.status,0,'wrong keyId must fail closed');
} finally {
  fs.rmSync(tmp,{recursive:true,force:true});
}

console.log('ENTITLEMENT_PROVISIONER_V240_OK');
console.log('ENTITLEMENT_EPHEMERAL_P256_OK');
console.log('ENTITLEMENT_TAMPER_REJECTED_OK');
console.log('ENTITLEMENT_CATALOG_DEPENDENCIES_OK');
console.log('ENTITLEMENT_PRIVATE_KEY_NOT_LOGGED_OK');
