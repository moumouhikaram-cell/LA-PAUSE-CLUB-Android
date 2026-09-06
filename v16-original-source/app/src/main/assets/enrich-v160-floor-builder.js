'use strict';
/* LA PAUSE CLUB v1.6 — additive floor geometry engine.
 * The historic Gaming Floor remains authoritative for operations and UI.
 * This module only manages an optional geometric projection of existing station ids.
 */
(function(){
  const X=window.LP160;if(!X)return;
  const SCHEMA='LP160_FLOOR_V1',MAX_SNAPSHOTS=10;
  function S(){return X.safeState()||{};}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function n(v,d=0){const x=Number(v);return Number.isFinite(x)?x:d;}
  function clamp(v,min,max){return Math.min(max,Math.max(min,n(v,min)));}
  function id(prefix){return typeof uid==='function'?uid(prefix):`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;}
  function stations(){return Array.isArray(S().stations)?S().stations:[];}
  function stationIds(){return new Set(stations().map(s=>String(s.id||'')).filter(Boolean));}
  function defaultSize(st){
    const t=String(st?.osResourceType||st?.resourceType||st?.type||'CUSTOM').toUpperCase();
    if(t==='SIM'||t==='SIM_RACING')return {w:22,h:20};
    if(t==='BILLIARD'||t==='BILLIARD_TABLE'||t==='SNOOKER'||t==='SNOOKER_TABLE')return {w:30,h:22};
    if(t==='PRIVATE_ROOM')return {w:34,h:28};
    return {w:18,h:18};
  }
  function draftFromLegacy(){
    const list=stations().filter(s=>s&&s.id).slice().sort((a,b)=>n(a.sort,999)-n(b.sort,999));
    const cols=Math.max(1,Math.min(4,Math.ceil(Math.sqrt(Math.max(1,list.length))))),gap=4,cellW=(100-gap*(cols+1))/cols;
    const rows=Math.max(1,Math.ceil(list.length/cols)),cellH=(100-gap*(rows+1))/rows;
    const placements={};
    list.forEach((st,i)=>{
      const col=i%cols,row=Math.floor(i/cols),sz=defaultSize(st),w=Math.min(sz.w,Math.max(8,cellW-2)),h=Math.min(sz.h,Math.max(8,cellH-2));
      placements[st.id]={stationId:st.id,zoneId:'zone-main',x:clamp(gap+col*(cellW+gap)+(cellW-w)/2,0,100-w),y:clamp(gap+row*(cellH+gap)+(cellH-h)/2,0,100-h),w,h,rotation:0};
    });
    return {schema:SCHEMA,revision:0,canvas:{width:100,height:100,unit:'PERCENT'},zones:{'zone-main':{id:'zone-main',name:'Salle principale',x:0,y:0,w:100,h:100}},placements,walls:[],createdAt:Date.now(),updatedAt:Date.now(),source:'V1.6_STATIONS_PROJECTION'};
  }
  function normalizeZone(z,key){
    z=z&&typeof z==='object'?z:{};const idv=String(z.id||key||'').trim();
    const w=clamp(z.w,1,100),h=clamp(z.h,1,100);
    return {id:idv,name:String(z.name||idv||'Zone'),x:clamp(z.x,0,100-w),y:clamp(z.y,0,100-h),w,h};
  }
  function normalizePlacement(p,key){
    p=p&&typeof p==='object'?p:{};const stationId=String(p.stationId||key||'').trim(),w=clamp(p.w,2,100),h=clamp(p.h,2,100);
    return {stationId,zoneId:p.zoneId==null?null:String(p.zoneId),x:clamp(p.x,0,100-w),y:clamp(p.y,0,100-h),w,h,rotation:((n(p.rotation)%360)+360)%360};
  }
  function normalizeWall(w){
    w=w&&typeof w==='object'?w:{};
    return {id:String(w.id||id('wall')),x1:clamp(w.x1,0,100),y1:clamp(w.y1,0,100),x2:clamp(w.x2,0,100),y2:clamp(w.y2,0,100)};
  }
  function normalize(plan){
    const p=plan&&typeof plan==='object'?clone(plan):draftFromLegacy(),zones={},placements={};
    Object.entries(p.zones&&typeof p.zones==='object'?p.zones:{}).forEach(([k,v])=>{const z=normalizeZone(v,k);if(z.id)zones[z.id]=z;});
    if(!Object.keys(zones).length)zones['zone-main']={id:'zone-main',name:'Salle principale',x:0,y:0,w:100,h:100};
    Object.entries(p.placements&&typeof p.placements==='object'?p.placements:{}).forEach(([k,v])=>{const q=normalizePlacement(v,k);if(q.stationId)placements[q.stationId]=q;});
    return {schema:SCHEMA,revision:Math.max(0,Math.floor(n(p.revision))),canvas:{width:100,height:100,unit:'PERCENT'},zones,placements,walls:(Array.isArray(p.walls)?p.walls:[]).map(normalizeWall),createdAt:n(p.createdAt,Date.now()),updatedAt:Date.now(),source:String(p.source||'V1.6_FLOOR_BUILDER')};
  }
  function validate(plan,{requireAllStations=true}={}){
    const p=normalize(plan),ids=stationIds(),errors=[],warnings=[];
    if(p.schema!==SCHEMA)errors.push('SCHEMA_INVALID');
    const seen=new Set();
    Object.entries(p.placements).forEach(([key,q])=>{
      if(key!==q.stationId)errors.push(`PLACEMENT_KEY_MISMATCH:${key}`);
      if(seen.has(q.stationId))errors.push(`DUPLICATE_STATION:${q.stationId}`);seen.add(q.stationId);
      if(!ids.has(q.stationId))errors.push(`UNKNOWN_STATION:${q.stationId}`);
      if(q.zoneId&&!p.zones[q.zoneId])errors.push(`UNKNOWN_ZONE:${q.stationId}:${q.zoneId}`);
      if(q.x<0||q.y<0||q.x+q.w>100.0001||q.y+q.h>100.0001)errors.push(`OUT_OF_BOUNDS:${q.stationId}`);
    });
    if(requireAllStations)ids.forEach(stationId=>{if(!seen.has(stationId))errors.push(`MISSING_STATION:${stationId}`);});
    p.walls.forEach(w=>{const len=Math.hypot(w.x2-w.x1,w.y2-w.y1);if(len<0.5)errors.push(`WALL_TOO_SHORT:${w.id}`);});
    if(!p.walls.length)warnings.push('NO_WALLS');
    return {ok:errors.length===0,errors,warnings,plan:p};
  }
  function current(){const raw=S().v160FloorPlan;return raw&&raw.schema===SCHEMA?normalize(raw):null;}
  function snapshots(){const a=S().v160FloorSnapshots;return Array.isArray(a)?a:[];}
  function commit(plan,opt={}){
    if(opt.operatorExplicit!==true)throw new Error('Enregistrement opérateur explicite obligatoire');
    const check=validate(plan,{requireAllStations:opt.requireAllStations!==false});if(!check.ok)throw new Error(`Plan invalide: ${check.errors.join(', ')}`);
    const s=S(),prev=current();
    if(prev){if(!Array.isArray(s.v160FloorSnapshots))s.v160FloorSnapshots=[];s.v160FloorSnapshots.push({id:id('floor-snap'),at:Date.now(),revision:prev.revision,plan:clone(prev)});if(s.v160FloorSnapshots.length>MAX_SNAPSHOTS)s.v160FloorSnapshots=s.v160FloorSnapshots.slice(-MAX_SNAPSHOTS);}
    const next=check.plan;next.revision=(prev?.revision||0)+1;next.updatedAt=Date.now();next.committedAt=Date.now();next.committedBy='OPERATOR';s.v160FloorPlan=next;
    X.persist('v160.floor.committed','floor',{revision:next.revision,stations:Object.keys(next.placements).length,zones:Object.keys(next.zones).length,walls:next.walls.length});
    return clone(next);
  }
  function rollback(snapshotId,opt={}){
    if(opt.operatorExplicit!==true)throw new Error('Rollback opérateur explicite obligatoire');
    const s=S(),list=snapshots(),snap=list.find(x=>x.id===snapshotId);if(!snap)throw new Error('Snapshot introuvable');
    const check=validate(snap.plan,{requireAllStations:false});if(!check.ok)throw new Error(`Snapshot invalide: ${check.errors.join(', ')}`);
    const prev=current();if(prev){if(!Array.isArray(s.v160FloorSnapshots))s.v160FloorSnapshots=[];s.v160FloorSnapshots.push({id:id('floor-snap'),at:Date.now(),revision:prev.revision,plan:clone(prev)});}
    const restored=check.plan;restored.revision=(prev?.revision||0)+1;restored.updatedAt=Date.now();restored.rollbackOf=snapshotId;s.v160FloorPlan=restored;
    if(s.v160FloorSnapshots.length>MAX_SNAPSHOTS)s.v160FloorSnapshots=s.v160FloorSnapshots.slice(-MAX_SNAPSHOTS);
    X.persist('v160.floor.rolled_back','floor',{snapshotId,revision:restored.revision});return clone(restored);
  }
  function moveStation(plan,stationId,x,y){const p=normalize(plan),q=p.placements[stationId];if(!q)throw new Error('Poste absent du plan');q.x=clamp(x,0,100-q.w);q.y=clamp(y,0,100-q.h);p.updatedAt=Date.now();return p;}
  function resizeStation(plan,stationId,w,h){const p=normalize(plan),q=p.placements[stationId];if(!q)throw new Error('Poste absent du plan');q.w=clamp(w,2,100);q.h=clamp(h,2,100);q.x=clamp(q.x,0,100-q.w);q.y=clamp(q.y,0,100-q.h);p.updatedAt=Date.now();return p;}
  function moveZone(plan,zoneId,x,y){const p=normalize(plan),z=p.zones[zoneId];if(!z)throw new Error('Zone absente');z.x=clamp(x,0,100-z.w);z.y=clamp(y,0,100-z.h);p.updatedAt=Date.now();return p;}
  function addZone(plan,name,rect={}){const p=normalize(plan),zoneId=id('zone');p.zones[zoneId]=normalizeZone({id:zoneId,name:String(name||'Zone'),x:rect.x??5,y:rect.y??5,w:rect.w??35,h:rect.h??25},zoneId);return p;}
  function assignZone(plan,stationId,zoneId){const p=normalize(plan);if(!p.placements[stationId])throw new Error('Poste absent du plan');if(zoneId&&!p.zones[zoneId])throw new Error('Zone absente');p.placements[stationId].zoneId=zoneId||null;return p;}
  function addWall(plan,a,b){const p=normalize(plan),w=normalizeWall({id:id('wall'),x1:a?.x,y1:a?.y,x2:b?.x,y2:b?.y});if(Math.hypot(w.x2-w.x1,w.y2-w.y1)<0.5)throw new Error('Mur trop court');p.walls.push(w);return p;}
  function removeWall(plan,wallId){const p=normalize(plan);p.walls=p.walls.filter(w=>w.id!==wallId);return p;}
  function projection(plan=current()||draftFromLegacy()){
    const p=normalize(plan),live=Object.fromEntries(stations().map(st=>[st.id,st]));
    return Object.values(p.placements).map(q=>({stationId:q.stationId,station:live[q.stationId]||null,geometry:clone(q),zone:p.zones[q.zoneId]||null}));
  }
  function stats(plan=current()||draftFromLegacy()){const p=normalize(plan);return {schema:p.schema,revision:p.revision,stations:Object.keys(p.placements).length,zones:Object.keys(p.zones).length,walls:p.walls.length,snapshots:snapshots().length};}

  X.floorBuilder={SCHEMA,draftFromLegacy,normalize,validate,current,snapshots,commit,rollback,moveStation,resizeStation,moveZone,addZone,assignZone,addWall,removeWall,projection,stats};
  X.register('floor-builder',{mode:'GEOMETRY_ONLY_V1.6_ADAPTER',ui:'UNCHANGED',autoPersist:false,stationAuthority:'V1.6_STATE',schema:SCHEMA,rollback:true});
})();
