'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'app/src/main/assets/client-product-session-policy.js'),'utf8');
let seq=0,clock=100000;
const ctx={console,JSON,Math,Date};ctx.window=ctx;
ctx.num=(v,d=0)=>Number.isFinite(+v)?+v:d;ctx.roundTo=(v,s=.5)=>s?Math.round(v/s)*s:v;ctx.deepClone=o=>JSON.parse(JSON.stringify(o));ctx.uid=p=>`${p}_${++seq}`;ctx.now=()=>++clock;ctx.toast=m=>ctx.toasts.push(m);ctx.closeSheet=()=>{};ctx.renderView=()=>{};ctx.vibrate=()=>{};ctx.scheduleAlarm=()=>{};ctx.p1RateLabel=()=> '22 MAD/h';ctx.saveState=()=>{};
ctx.stationById=id=>ctx.state.stations.find(x=>x.id===id);ctx.sessionById=id=>ctx.state.sessions.find(x=>x.id===id);ctx.activeSessionFor=id=>ctx.state.sessions.find(x=>x.stationId===id&&['active','paused'].includes(x.status))||null;ctx.currentShift=()=>ctx.state.shifts.find(x=>x.status==='open')||null;ctx.p1RateFor=()=>22;
ctx.m2SessionShape=(st,d)=>{const amount=d.mode==='open'?0:22;return{id:ctx.uid('sess'),stationId:st.id,resourceId:st.id,resourceType:'CONSOLE',status:amount>0?'awaiting_payment':'requested',mode:d.mode,startAt:ctx.now(),endAt:d.mode==='open'?null:ctx.now()+3600000,plannedMinutes:d.mode==='open'?null:60,players:1,totalAmount:amount,baseAmount:amount,discountAmount:0,revision:0,gameTitle:'EA SPORTS FC',createdAt:ctx.now(),updatedAt:ctx.now()}};
ctx.m2Commit=(type,entityType,entityId,expected,mutate)=>{const next=ctx.deepClone(ctx.state);mutate(next);const arr=entityType==='SESSION'?next.sessions:entityType==='PAYMENT'?next.payments:entityType==='SHIFT'?next.shifts:null;if(arr){const e=arr.find(x=>x.id===entityId);if(e)e.revision=ctx.num(e.revision)+1}ctx.state=next;return{ok:true,state:next,type}};ctx.window.m2Commit=ctx.m2Commit;
function reset({payNow=true,timing='start'}={}){seq=0;ctx.toasts=[];ctx.state={stations:[{id:'ps5-1',name:'PS5 1',enabled:true}],sessions:[],payments:[],shifts:[],rates:{rounding:.5},sessionRules:{defaultPaymentTiming:timing},cashSettings:{defaultMethod:'cash'},meta:{deviceId:'test-device'}};ctx.selectedStationId='ps5-1';ctx.sheetDraft={mode:'fixed',duration:60,players:1,payNow,discountAmount:0};}
vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'client-product-session-policy.js'});

reset({payNow:true,timing:'start'});ctx.window.startDraftSession();
assert.equal(ctx.state.shifts.length,1,'cash payment should auto-open one shift');assert.equal(ctx.state.shifts[0].autoOpened,true,'auto shift marker missing');assert.equal(ctx.state.payments.length,1,'payment missing');assert.equal(ctx.state.payments[0].shiftId,ctx.state.shifts[0].id,'payment not linked to auto shift');assert.equal(ctx.state.sessions[0].status,'active','session did not start after cash capture');
console.log('AUTO_SHIFT_SESSION_START_OK');

reset({payNow:false,timing:'end'});ctx.window.startDraftSession();
assert.equal(ctx.state.shifts.length,0,'deferred payment must not open cash shift');assert.equal(ctx.state.payments.length,0,'deferred session must not create payment');assert.equal(ctx.state.sessions[0].status,'active','deferred-payment session should start');
console.log('DEFERRED_SESSION_WITHOUT_CASH_OK');

reset({payNow:false,timing:'start'});ctx.window.startDraftSession();
assert.equal(ctx.state.shifts.length,0,'unpaid prepay request must not open shift');assert.equal(ctx.state.payments.length,0,'unpaid prepay request must not create payment');assert.equal(ctx.state.sessions[0].status,'awaiting_payment','prepay policy should keep session awaiting payment');assert(ctx.toasts.some(x=>String(x).includes('paiement requis')),'prepay feedback missing');
console.log('PREPAY_POLICY_OK');

reset({payNow:false,timing:'end'});ctx.state.sessions.push({id:'sess-existing',stationId:'ps5-1',status:'active',revision:1});ctx.window.addPayment(ctx.state.sessions[0],10,'cash','test');
assert.equal(ctx.state.shifts.length,1,'addPayment cash should auto-open shift');assert.equal(ctx.state.payments[0].shiftId,ctx.state.shifts[0].id,'manual payment not linked to auto shift');
console.log('MANUAL_CASH_AUTO_SHIFT_OK');
console.log('V230_SESSION_POLICY_TESTS_OK');
