'use strict';
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const runtime=fs.readFileSync(path.join(root,'app/src/main/assets/master-v2-runtime.js'),'utf8');
const schema=JSON.parse(fs.readFileSync(path.join(root,'../contracts/protocol/client-command-envelope.v2.schema.json'),'utf8'));
const must=(s,n,l)=>{if(!s.includes(n))throw new Error(`${l}: missing ${n}`)};

if(schema.properties?.schemaVersion?.const!==2)throw new Error('schemaVersion contract is not 2');
if(schema.properties?.protocolVersion?.const!=='la-pause-client/2')throw new Error('protocolVersion contract mismatch');
if(schema.additionalProperties!==false)throw new Error('canonical v2 schema must stay strict');
for(const k of ['schemaVersion','protocolVersion','commandId','idempotencyKey','commandType','tenantId','venueId','branchId','actorId','originDeviceId','issuedAt','payload']){
  if(!schema.required.includes(k))throw new Error(`schema required field missing: ${k}`);
}

const start=runtime.indexOf('function m2Command(');
const end=runtime.indexOf('function m2NativeCommand(',start);
if(start<0||end<0)throw new Error('m2Command/m2NativeCommand boundary missing');
const canonical=runtime.slice(start,end);
for(const token of [
  'schemaVersion:2','protocolVersion:M2_PROTOCOL','commandId:id','idempotencyKey:',
  'commandType','tenantId:m2Tenant()','venueId:m2Venue()','branchId:m2Branch()',
  'actorId:m2Actor()','originDeviceId:m2Device()','clientType:\'ANDROID\'',
  'baseRevision:','issuedAt:now()','payloadSchemaVersion:1','payload'
]) must(canonical,token,'canonical command');
if(/\btype\s*:/.test(canonical))throw new Error('legacy type leaked into canonical v2 command');
if(/expectedRevision\s*:/.test(canonical))throw new Error('legacy expectedRevision leaked into canonical v2 command');

const adapterStart=end;
const adapterEnd=runtime.indexOf('function m2Commit(',adapterStart);
const adapter=runtime.slice(adapterStart,adapterEnd);
must(adapter,'type:command.commandType','Android legacy type adapter');
must(adapter,'expectedRevision:command.baseRevision','Android legacy revision adapter');

const commitStart=adapterEnd;
const commitEnd=runtime.indexOf('window.m2Commit=m2Commit;',commitStart);
const commit=runtime.slice(commitStart,commitEnd);
must(commit,'JSON.stringify(m2NativeCommand(cmd))','native adapter usage');
must(runtime,"state.meta.clientProtocol=M2_PROTOCOL",'runtime protocol diagnostic');
must(runtime,"state.meta.androidCommandCore='DB_V11_AUTH_V12'",'runtime native core diagnostic');
must(runtime,'window.MasterV2={contract:M2_CONTRACT,protocol:M2_PROTOCOL','public protocol diagnostic');

const literalTypes=[...runtime.matchAll(/m2Commit\('([^']+)'/g)].map(m=>m[1]);
const literalExpected=['SESSION.REQUEST','SESSION.PAY','SESSION.START','PAYMENT.RECORD','QUEUE.JOIN'];
for(const t of literalExpected)if(!literalTypes.includes(t))throw new Error(`critical canonical command missing: ${t}`);

const refundStart=runtime.indexOf('function m2RefundCore(');
const refundEnd=runtime.indexOf('window.p1PartialRefund=',refundStart);
if(refundStart<0||refundEnd<0)throw new Error('refund core boundary missing');
const refundCore=runtime.slice(refundStart,refundEnd);
must(refundCore,"m2Commit(amt>=max-.001?'REFUND.FULL':'REFUND.PARTIAL'",'conditional refund command');
for(const t of ['REFUND.FULL','REFUND.PARTIAL'])must(refundCore,`'${t}'`,'refund command type');

console.log('CLIENT_COMMAND_PROTOCOL_V2_OK');
console.log('CLIENT_COMMAND_V2_SCHEMA_STRICT_OK');
console.log('CLIENT_COMMAND_ANDROID_COMPAT_ADAPTER_OK');
console.log('CLIENT_COMMAND_CRITICAL_TYPES_OK '+(literalTypes.length+2));
