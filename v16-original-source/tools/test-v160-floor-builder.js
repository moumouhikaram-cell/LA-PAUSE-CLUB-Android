'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.resolve(__dirname,'../app/src/main/assets/enrich-v160-floor-builder.js'),'utf8');
const events=[];let seq=0;
const state={stations:[
  {id:'ps5-1',name:'PS5 1',type:'PS5',enabled:true,sort:1},
  {id:'ps5-2',name:'PS5 2',type:'PS5',enabled:true,sort:2},
  {id:'sim-1',name:'SIM VIP',type:'SIM',enabled:true,sort:3}
],sessions:[{id:'s1',stationId:'ps5-1',status:'active'}],meta:{}};
const stationSnapshot=JSON.stringify(state.stations),modules=new Map();
const ctx={console,Date,Set,Map,Math,JSON,Number,String,Object,Array,state,uid:p=>`${p}_${++seq}`,window:null};
ctx.LP160={safeState:()=>state,persist:(eventType,entityId,payload)=>{events.push({eventType,entityId,payload});return true},register:(name,meta)=>{modules.set(name,meta);return meta}};
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(src,ctx,{filename:'enrich-v160-floor-builder.js'});
function ok(v,msg){if(!v)throw new Error(msg)}
const F=ctx.LP160.floorBuilder;ok(F,'floor builder API missing');ok(modules.has('floor-builder'),'floor builder module not registered');
ok(state.v160FloorPlan===undefined&&state.v160FloorSnapshots===undefined,'floor module mutated ClubState on load');
let draft=F.draftFromLegacy();ok(draft.schema==='LP160_FLOOR_V1','floor schema mismatch');ok(Object.keys(draft.placements).length===3,'legacy projection missed stations');ok(state.v160FloorPlan===undefined,'draft must not persist automatically');ok(JSON.stringify(state.stations)===stationSnapshot,'draft changed station truth');
const projected=F.projection(draft);ok(projected.length===3&&projected.every(x=>x.station&&x.station.id===x.stationId),'projection detached from v1.6 station ids');
draft=F.moveStation(draft,'ps5-1',91,97);ok(draft.placements['ps5-1'].x<=100-draft.placements['ps5-1'].w&&draft.placements['ps5-1'].y<=100-draft.placements['ps5-1'].h,'station move not clamped');
draft=F.resizeStation(draft,'ps5-1',30,25);ok(draft.placements['ps5-1'].w===30&&draft.placements['ps5-1'].h===25,'station resize failed');
draft=F.addZone(draft,'VIP',{x:70,y:70,w:25,h:25});const vip=Object.keys(draft.zones).find(k=>k!=='zone-main');ok(vip,'zone creation failed');draft=F.assignZone(draft,'sim-1',vip);ok(draft.placements['sim-1'].zoneId===vip,'zone assignment failed');
draft=F.addWall(draft,{x:10,y:10},{x:80,y:10});ok(draft.walls.length===1,'wall creation failed');
const check=F.validate(draft);ok(check.ok,'valid draft rejected: '+check.errors.join(','));
let implicit=false;try{F.commit(draft)}catch(_){implicit=true}ok(implicit,'floor commit without explicit operator action accepted');ok(state.v160FloorPlan===undefined,'implicit commit persisted floor state');
const committed1=F.commit(draft,{operatorExplicit:true});ok(committed1.revision===1&&state.v160FloorPlan.revision===1,'first explicit floor commit failed');ok(JSON.stringify(state.stations)===stationSnapshot,'floor commit changed station truth');
let second=F.moveStation(committed1,'ps5-2',60,40);second=F.addWall(second,{x:20,y:20},{x:20,y:80});const committed2=F.commit(second,{operatorExplicit:true});ok(committed2.revision===2,'second floor revision wrong');ok(Array.isArray(state.v160FloorSnapshots)&&state.v160FloorSnapshots.length===1,'previous plan snapshot missing');
const snap=state.v160FloorSnapshots[0],oldX=snap.plan.placements['ps5-2'].x;ok(committed2.placements['ps5-2'].x!==oldX,'test move did not change geometry');
let implicitRollback=false;try{F.rollback(snap.id)}catch(_){implicitRollback=true}ok(implicitRollback,'floor rollback without explicit operator action accepted');const restored=F.rollback(snap.id,{operatorExplicit:true});ok(restored.placements['ps5-2'].x===oldX,'rollback did not restore snapshot geometry');ok(restored.revision===3,'rollback did not advance revision');ok(JSON.stringify(state.stations)===stationSnapshot,'rollback changed station truth');
const missing=F.normalize(restored);delete missing.placements['sim-1'];const missingCheck=F.validate(missing);ok(!missingCheck.ok&&missingCheck.errors.includes('MISSING_STATION:sim-1'),'missing station placement not rejected');
const unknown=F.normalize(restored);unknown.placements.ghost={stationId:'ghost',zoneId:'zone-main',x:1,y:1,w:10,h:10,rotation:0};const unknownCheck=F.validate(unknown,{requireAllStations:false});ok(!unknownCheck.ok&&unknownCheck.errors.includes('UNKNOWN_STATION:ghost'),'unknown station placement not rejected');
let shortWallBlocked=false;try{F.addWall(restored,{x:5,y:5},{x:5.1,y:5.1})}catch(_){shortWallBlocked=true}ok(shortWallBlocked,'zero/short wall accepted');
ok(events.filter(e=>e.eventType==='v160.floor.committed').length===2,'floor commit audit events missing');ok(events.some(e=>e.eventType==='v160.floor.rolled_back'),'floor rollback audit event missing');
console.log('V160_FLOOR_DRAFT_NO_SIDE_EFFECT_OK');
console.log('V160_FLOOR_STATION_AUTHORITY_OK');
console.log('V160_FLOOR_GEOMETRY_VALIDATION_OK');
console.log('V160_FLOOR_SNAPSHOT_ROLLBACK_OK');
console.log('V160_FLOOR_BUILDER_GATE_OK');
