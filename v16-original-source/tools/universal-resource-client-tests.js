'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
global.window=global;global.localStorage={setItem(){}};let seq=0;
global.now=()=>1700000000000+(seq++);global.uid=(p='id')=>`${p}-${seq++}`;global.num=(x,f=0)=>Number.isFinite(+x)?+x:f;global.roundTo=(x,s=.5)=>s>0?Math.round(x/s)*s:x;global.deepClone=o=>JSON.parse(JSON.stringify(o));global.esc=x=>String(x);global.fmtMoney=x=>`${x} MAD`;global.toast=()=>{};global.closeSheet=()=>{};global.renderView=()=>{};global.showModal=()=>{};global.showSheet=()=>{};global.vibrate=()=>{};global.scheduleAlarm=()=>{};global.$=()=>null;global.gameInfo=()=>({media:'media/idle.svg'});global.cssUrl=x=>`url(${x})`;global.GAME_LIBRARY_V12=[];
global.V172_OPERATIONAL_TYPES=new Set();global.v172OsType=st=>String(st?.osResourceType||st?.type||'CUSTOM').toUpperCase();
global.state={meta:{deviceId:'android-test'},business:{currency:'MAD'},rates:{ps5Solo:22,ps5Duo:28,sim:45,rounding:.5,minimumCharge:0},sessionRules:{defaultDuration:60,defaultPaymentTiming:'start',allowOpenSession:true},ratePlans:[],stations:[],sessions:[],payments:[],clients:[],shifts:[{id:'shift-1',status:'open'}],outbox:[]};
global.stationById=id=>state.stations.find(s=>s.id===id);global.sessionById=id=>state.sessions.find(s=>s.id===id);global.activeSessionFor=id=>state.sessions.find(s=>(s.stationId===id||s.resourceId===id)&&['active','paused'].includes(String(s.status||'').toLowerCase()))||null;global.currentShift=()=>state.shifts.find(x=>x.status==='open')||null;global.sessionElapsedMinutes=()=>60;global.sessionElapsedMs=()=>3600000;
vm.runInThisContext(fs.readFileSync('app/src/main/assets/p1-core.js','utf8'),{filename:'p1-core.js'});
const types=[['CONSOLE',22,2],['SIM_RACING',45,1],['PC_GAMING',30,1],['BILLIARD_TABLE',35,2],['SNOOKER_TABLE',40,2]];
for(const [type,rate,maxPlayers] of types){
 const st={id:`${type.toLowerCase()}-1`,name:`${type} 1`,osResourceType:type,type,enabled:true,maxPlayers};state.stations.push(st);
 if(!['CONSOLE','SIM_RACING'].includes(type))state.ratePlans.push({id:`rate-${type}`,scope:'TYPE',resourceType:type,name:`${type} standard`,pricingModel:'FLAT_HOURLY',hourlyRate:rate,playerRates:{'1':rate,'2':rate},currency:'MAD',enabled:true,revision:1});
 assert.strictEqual(p1ResourceType(st),type,`${type}: normalized type`);
 assert.strictEqual(p1RateFor(st,1),rate,`${type}: configured rate must be recognized`);
 assert(p1CalcAmount(st,60,1)>0,`${type}: 60-minute quote must be billable`);
 const snap=p1PricingSnapshot(st,1);assert.strictEqual(snap.resourceType,type);assert.strictEqual(snap.hourlyRate,rate);
}
for(const t of ['CONSOLE','SIM_RACING','PC_GAMING','BILLIARD_TABLE','SNOOKER_TABLE'])assert(V172_OPERATIONAL_TYPES.has(t),`${t}: must be operational`);
console.log('UNIVERSAL_RESOURCE_CLIENT_TESTS_OK');
