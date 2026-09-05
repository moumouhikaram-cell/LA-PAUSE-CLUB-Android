'use strict';
(function(){
  var A=window.LPOS,U=window.LPOSScreens,S=A&&A.state;
  if(!A||!U||!S)return;
  var M='../media/',P=M+'premium/',PR=M+'products/';
  S.ui=S.ui||{};
  S.ui.v296=S.ui.v296||{tabs:{},filters:{},period:'Today'};
  var V=S.ui.v296;

  function num(v,d){v=Number(v);return Number.isFinite(v)?v:(d||0);}
  function esc(v){return U.esc(v==null?'':v);}
  function now(){return A.now?A.now():Date.now();}
  function screen(){return num(S.ui.screen,42);}
  function isOps(){var n=screen();return !!(S.identity&&S.identity.signedIn)&&n>=11&&n<=60&&n!==44;}
  function persist(type,payload){A.persist(type||null,payload||null);}
  function money(v){return A.money?A.money(v):String(v||0)+' MAD';}
  function svg(k){
    var p={
      home:'<path d="m3 11 9-7 9 7v9H6v-9"/><path d="M9 20v-6h6v6"/>',
      users:'<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2.5 20c.4-4.2 2.4-6 5.5-6s5.1 1.8 5.5 6M10.5 20c.4-3.6 2.2-5.2 5.3-5.2s4.9 1.6 5.2 5.2"/>',
      clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
      cash:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>',
      more:'<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
      game:'<path d="M7 9h10c3 0 5 2 5 5l-1 4c-.3 1.4-1.7 2.3-3 1.5L15 17H9l-3 2.5c-1.3.8-2.7-.1-3-1.5l-1-4c0-3 2-5 5-5z"/><path d="M7 12v4M5 14h4M16 13h.01M19 16h.01"/>',
      monitor:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
      sim:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M4 12h5M15 12h5M12 4v5"/>',
      billiard:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M9 7h6M9 17h6"/>',
      calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
      queue:'<path d="M5 7h14M5 12h10M5 17h7"/><circle cx="20" cy="17" r="2"/>',
      trophy:'<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 13v5M8 21h8M9 18h6"/>',
      chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20V7"/>',
      settings:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.8-1L14.4 3h-4.8l-.4 3.1a7 7 0 0 0-1.8 1L5 6.1 3 9.5 5 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.8 1l.4 3.1h4.8l.4-3.1a7 7 0 0 0 1.8-1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1z"/>',
      shield:'<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="m9 12 2 2 4-5"/>',
      box:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M9 4v16"/>',
      food:'<path d="M7 3h10l-1 18H8zM5 7h14M9 11h6"/>',
      link:'<path d="M9 15l6-6M7 17l-2 2a3 3 0 0 1-4-4l4-4a3 3 0 0 1 4 0M17 7l2-2a3 3 0 0 1 4 4l-4 4a3 3 0 0 1-4 0"/>',
      wrench:'<path d="M14 6a4 4 0 0 0-5 5L3 17l4 4 6-6a4 4 0 0 0 5-5l-3 3-3-3z"/>',
      plus:'<path d="M12 5v14M5 12h14"/>',
      back:'<path d="m15 5-7 7 7 7"/>',
      close:'<path d="M6 6l12 12M18 6 6 18"/>',
      check:'<path d="m5 12 4 4L19 6"/>',
      bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
      sync:'<path d="M20 7h-5V2M4 17h5v5"/><path d="M18 5a8 8 0 0 0-13 3M6 19a8 8 0 0 0 13-3"/>'
    };
    return '<svg class="v296-icon" viewBox="0 0 24 24" aria-hidden="true">'+(p[k]||p.box)+'</svg>';
  }

  function toast(msg){
    var r=document.getElementById('toastRoot');if(!r)return;
    r.innerHTML='<div class="toast">'+esc(msg)+'</div>';
    clearTimeout(window.__v296Toast);
    window.__v296Toast=setTimeout(function(){if(r)r.innerHTML='';},1900);
  }

  function pushCurrent(target){
    target=num(target);
    S.ui.navStack=Array.isArray(S.ui.navStack)?S.ui.navStack:[];
    var cur=screen();
    if(cur!==target&&cur!==12&&cur!==42){
      if(S.ui.navStack[S.ui.navStack.length-1]!==cur)S.ui.navStack.push(cur);
      if(S.ui.navStack.length>50)S.ui.navStack=S.ui.navStack.slice(-50);
    }
  }
  function go(target,opts){
    target=num(target);
    if(target===12)target=42;
    if(!U.byNo[target])return;
    opts=opts||{};
    if(opts.push!==false)pushCurrent(target);
    if(target===42&&opts.clear!==false)S.ui.navStack=[];
    S.ui.screen=target;S.ui.scroll=0;persist('NAVIGATE',{screen:target});location.reload();
  }

  function normalizeGraph(){
    var dirty=false;
    if(!Array.isArray(S.zones)){S.zones=[];dirty=true;}
    if(!Array.isArray(S.resources)){S.resources=[];dirty=true;}
    if(!Array.isArray(S.devices)){S.devices=[];dirty=true;}
    if(!Array.isArray(S.bookings)){S.bookings=[];dirty=true;}
    var zonesByName={};S.zones.forEach(function(z){if(z&&z.name)zonesByName[String(z.name).toLowerCase()]=z;});
    S.resources.forEach(function(r,i){
      if(!r)return;
      var sort=num(r.sort,i+1),type=A.resourceType(r);
      if(r.sort!==sort){r.sort=sort;dirty=true;}
      if(r.resourceType!==type){r.resourceType=type;dirty=true;}
      if(!r.zoneId&&r.zone){
        var z=zonesByName[String(r.zone).toLowerCase()];
        if(z){r.zoneId=z.id;dirty=true;}
      }
      if(r.zoneId&&!r.zone){
        var zz=S.zones.find(function(z){return z.id===r.zoneId;});if(zz){r.zone=zz.name;dirty=true;}
      }
    });
    S.devices.forEach(function(d){
      if(!d)return;
      if(!d.resourceId&&d.stationId){d.resourceId=d.stationId;dirty=true;}
      if(d.resourceId&&!d.stationId){d.stationId=d.resourceId;dirty=true;}
    });
    if(dirty)persist('RESOURCE_GRAPH_NORMALIZED',{resources:S.resources.length,devices:S.devices.length,bookings:S.bookings.length});
  }

  function resourceImage(r){
    var t=A.resourceType(r);
    if(t==='CONSOLE')return M+'ps5-available.png';
    if(t==='SIM_RACING')return M+'sim-vip.png';
    if(t==='PC_GAMING')return P+'pc.jpg';
    if(t==='BILLIARD_TABLE')return P+'billiard.jpg';
    if(t==='SNOOKER_TABLE')return P+'snooker.jpg';
    return P+'arcade.jpg';
  }
  function productImage(p){
    var q=String((p&&p.name)||'').toLowerCase();
    if(/red.?bull/.test(q))return PR+'redbull.jpg';
    if(/coca|cola/.test(q))return PR+'cocacola.jpg';
    if(/snicker/.test(q))return PR+'snickers.jpg';
    if(/twix/.test(q))return PR+'twix.jpg';
    if(/oreo/.test(q))return PR+'oreo.jpg';
    if(/lays|chips/.test(q))return PR+'lays.jpg';
    if(/fanta/.test(q))return PR+'fanta.jpg';
    if(/sprite/.test(q))return PR+'sprite.jpg';
    if(/eau|water/.test(q))return PR+'water.svg';
    return PR+'chips.svg';
  }

  function linkedDevice(resourceId){return (S.devices||[]).find(function(d){return String(d.resourceId||d.stationId||'')===String(resourceId);})||null;}
  function deviceState(r){
    var d=linkedDevice(r.id),sess=A.sessionFor(r.id),rs=String(r.status||'').toUpperCase();
    if(rs==='MAINTENANCE'||rs==='ERROR'||rs==='OFFLINE'||rs==='BLOCKED')return {label:rs,cls:'red',device:d};
    if(sess)return {label:'IN USE',cls:'green',device:d};
    if(!d)return {label:'NOT PAIRED',cls:'amber',device:null};
    var ds=String(d.status||'PENDING').toUpperCase();
    return {label:ds,cls:ds==='ONLINE'?'green':ds==='OFFLINE'||ds==='ERROR'?'red':'amber',device:d};
  }

  function statusBadge(label,cls){return '<span class="badge '+(cls||'')+'">'+esc(label)+'</span>';}
  function metric(label,value,sub,icon){return '<div class="metric has-icon"><span class="kpi-icon">'+svg(icon||'box')+'</span><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong><em>'+esc(sub||'')+'</em></div>';}
  function row(icon,name,sub,side,action){
    return '<div class="crow" '+(action?'data-v296="'+esc(action)+'"':'')+'><div class="row-icon">'+svg(icon)+'</div><div class="grow"><b>'+esc(name)+'</b><small>'+esc(sub||'')+'</small></div>'+(side||'')+'</div>';
  }
  function tabStrip(items,active){
    return '<div class="canon-tabs">'+items.map(function(x){return '<button class="'+(x===active?'active':'')+'" data-v296-tab="'+esc(x)+'">'+esc(x)+'</button>';}).join('')+'</div>';
  }

  function registerDeviceScreens(){
    U.register(29,function(){
      var rs=A.resources(),paired=rs.filter(function(r){return !!linkedDevice(r.id);}),online=paired.filter(function(r){var d=linkedDevice(r.id);return d&&String(d.status).toUpperCase()==='ONLINE';}),off=paired.filter(function(r){var d=linkedDevice(r.id);return d&&['OFFLINE','ERROR'].indexOf(String(d.status).toUpperCase())>=0;}),maint=rs.filter(function(r){return String(r.status||'').toUpperCase()==='MAINTENANCE';});
      var types={};rs.forEach(function(r){var t=A.resourceType(r);types[t]=(types[t]||0)+1;});
      return '<div class="canon-screen v296-device-screen">'+
        tabStrip(['Devices','Monitors','Locations','Settings'],V.tabs['29']||'Devices')+
        '<div class="canon-grid g4">'+metric('Floor Resources',String(rs.length),'from floor plan','monitor')+metric('Paired',String(paired.length),'linked agents','link')+metric('Online',String(online.length),'real heartbeat','check')+metric('Attention',String(off.length+maint.length),'offline / maintenance','wrench')+'</div>'+
        '<div class="canon-grid g2 land2" style="margin-top:10px"><section class="canon-card pad"><div class="status-line"><h3 style="margin:0">Fleet Health</h3>'+statusBadge(paired.length?(Math.round(online.length/Math.max(1,paired.length)*100)+'% ONLINE'):'NOT PAIRED',paired.length?'green':'amber')+'</div><div class="v296-donut" style="--pct:'+(paired.length?Math.round(online.length/Math.max(1,paired.length)*100):0)+'"><b>'+(paired.length?Math.round(online.length/Math.max(1,paired.length)*100)+'%':'—')+'</b><span>online</span></div></section>'+
        '<section class="canon-card pad"><h3>Devices by Type</h3><div class="v296-type-grid">'+Object.keys(types).map(function(t){return '<div><span>'+svg(t==='CONSOLE'?'game':t==='SIM_RACING'?'sim':t==='PC_GAMING'?'monitor':t.indexOf('BILLIARD')>=0||t.indexOf('SNOOKER')>=0?'billiard':'box')+'</span><b>'+types[t]+'</b><small>'+esc(t.replace(/_/g,' '))+'</small></div>';}).join('')+'</div></section></div>'+
        '<div class="section-title">Location View</div><div class="row-list">'+(rs.length?rs.map(function(r){var st=deviceState(r),sess=A.sessionFor(r.id),sub=(r.zone||'Main')+' · '+(sess?'session active':st.device?'paired':'agent not paired');return row('monitor',r.name,sub,statusBadge(st.label,st.cls),'resource-device:'+r.id);}).join(''):'<div class="truth-empty"><b>No resource configured</b><small>Add equipment from Floor Builder.</small></div>')+'</div></div>';
    });
    U.register(30,function(){
      var rs=A.resources(),r=rs.find(function(x){return x.id===S.ui.selectedResourceId;})||rs[0],d=r&&linkedDevice(r.id),st=r?deviceState(r):null;
      if(!r)return '<div class="canon-screen">'+tabStrip(['Devices','Overlay','Pairing','Settings'],'Devices')+'<div class="truth-empty"><b>No resource selected</b><small>Create your floor first.</small><button class="cbtn primary" data-go="10">Open Floor Builder</button></div></div>';
      var caps=d&&Array.isArray(d.capabilities)?d.capabilities:[],overlay=!!(d&&String(d.status).toUpperCase()==='ONLINE'&&caps.indexOf('OVERLAY')>=0);
      return '<div class="canon-screen v296-device-detail">'+tabStrip(['Devices','Overlay','Pairing','Settings'],V.tabs['30']||'Devices')+
        '<section class="canon-card pad"><div class="v296-device-hero"><img src="'+resourceImage(r)+'" alt=""><div><div>'+statusBadge(st.label,st.cls)+'</div><h2>'+esc(r.name)+'</h2><p>'+esc(r.zone||'Main Floor')+' · '+esc(A.resourceType(r).replace(/_/g,' '))+'</p></div></div><div class="row-list">'+
        row('monitor','Resource ID',r.id,'')+row('link','Linked device',d?(d.name||d.id):'Not paired','')+row('clock','Last seen',d&&d.lastSeenAt?new Date(d.lastSeenAt).toLocaleString():'No heartbeat yet','')+'</div></section>'+
        '<div class="section-title">Pair Device</div><section class="canon-card pad"><p class="canon-sub">The floor resource is the source of truth. Pairing links a real Android/TV agent to this exact station.</p><button class="cbtn primary block" data-v296="pair-resource:'+esc(r.id)+'">'+(d?'Refresh pairing request':'Pair Device →')+'</button></section>'+
        '<div class="section-title">Overlay Status</div><section class="canon-card pad"><div class="status-line"><b>LA PAUSE OS Overlay</b>'+statusBadge(overlay?'OVERLAY RUNNING':d?'NOT CONFIRMED':'NOT PAIRED',overlay?'green':d?'amber':'')+'</div><p class="canon-sub">'+(overlay?'Capability confirmed by the paired device.':'No overlay success is shown until a real device heartbeat reports the capability.')+'</p></section></div>';
    });
  }

  function createBookingModal(){
    var root=document.getElementById('modalRoot');if(!root)return;
    var rs=A.resources(),start=new Date(now()+3600000);
    start.setMinutes(start.getMinutes()-start.getTimezoneOffset());
    var value=start.toISOString().slice(0,16);
    root.innerHTML='<div class="modal-backdrop"><section class="modal-sheet v296-sheet"><div class="modal-head"><b>New Booking</b><button class="icon-btn" data-v296="close-modal">'+svg('close')+'</button></div><div class="modal-body">'+
      '<div class="input-wrap"><label>Client / group</label><input id="v296BookingName" class="cinput" value="Walk-in"></div>'+
      '<div class="input-wrap"><label>Resource</label><select id="v296BookingResource" class="cselect">'+rs.map(function(r){return '<option value="'+esc(r.id)+'">'+esc(r.name)+' · '+esc(r.zone||'Main')+'</option>';}).join('')+'</select></div>'+
      '<div class="input-wrap"><label>Start</label><input id="v296BookingStart" class="cinput" type="datetime-local" value="'+value+'"></div>'+
      '<div class="input-wrap"><label>Duration</label><select id="v296BookingDuration" class="cselect"><option value="30">30 min</option><option value="60" selected>1 hour</option><option value="90">1h30</option><option value="120">2 hours</option><option value="180">3 hours</option></select></div>'+
      '<button class="cbtn primary block" data-v296="save-booking">Create Booking</button></div></section></div>';
  }
  function bookingConflict(resourceId,start,duration,ignoreId){
    var end=start+duration*60000;
    return (S.bookings||[]).some(function(b){
      if(b.id===ignoreId||b.resourceId!==resourceId||String(b.status).toUpperCase()==='CANCELLED')return false;
      var bs=num(b.startAt),be=bs+num(b.durationMinutes,60)*60000;
      return start<be&&end>bs;
    });
  }
  function saveBooking(){
    var name=(document.getElementById('v296BookingName')||{}).value||'Walk-in',
        rid=(document.getElementById('v296BookingResource')||{}).value,
        raw=(document.getElementById('v296BookingStart')||{}).value,
        dur=num((document.getElementById('v296BookingDuration')||{}).value,60),
        start=raw?new Date(raw).getTime():now()+3600000,
        r=A.resources().find(function(x){return x.id===rid;});
    if(!r){toast('Choose a resource');return;}
    if(bookingConflict(r.id,start,dur)){toast('Conflict: this resource is already booked');return;}
    var b=Object.assign(A.entityBase?A.entityBase(S.scope):{}, {
      id:A.uid('booking'),clientName:String(name).trim()||'Walk-in',resourceId:r.id,resourceType:A.resourceType(r),
      venueId:r.venueId||S.scope.venueId,branchId:r.branchId||S.scope.branchId,startAt:start,durationMinutes:dur,status:'CONFIRMED'
    });
    S.bookings.push(b);persist('BOOKING_CREATED',{bookingId:b.id,resourceId:r.id,startAt:start,durationMinutes:dur});
    closeModal();toast('Booking linked to '+r.name);
    if(screen()!==26)go(26);
    else location.reload();
  }

  function pairingModal(resourceId){
    var root=document.getElementById('modalRoot'),r=A.resources().find(function(x){return x.id===resourceId;});if(!root||!r)return;
    root.innerHTML='<div class="modal-backdrop"><section class="modal-sheet v296-sheet"><div class="modal-head"><b>Pair '+esc(r.name)+'</b><button class="icon-btn" data-v296="close-modal">'+svg('close')+'</button></div><div class="modal-body"><div class="v296-pair-code"><span>PAIRING REQUEST</span><b>'+String(Math.floor(100000+Math.random()*900000))+'</b><small>Enter this code on the real LA PAUSE device agent.</small></div><button class="cbtn primary block" data-v296="create-pairing:'+esc(r.id)+'">Create pending link</button></div></section></div>';
  }
  function createPairing(resourceId){
    var r=A.resources().find(function(x){return x.id===resourceId;});if(!r)return;
    var d=linkedDevice(r.id);
    if(!d){
      d=Object.assign(A.entityBase?A.entityBase(S.scope):{}, {
        id:A.uid('device'),name:r.name+' Agent',resourceId:r.id,stationId:r.id,status:'PENDING',
        deviceType:'ANDROID_AGENT',capabilities:[],pairedAt:null,lastSeenAt:null,verifiedByNative:false
      });
      S.devices.push(d);
    }else{
      d.status=String(d.status).toUpperCase()==='ONLINE'?'ONLINE':'PENDING';
      d.pairingRequestedAt=now();
    }
    r.deviceId=d.id;
    persist('DEVICE_PAIRING_REQUESTED',{deviceId:d.id,resourceId:r.id,status:d.status});
    closeModal();toast('Pairing pending — waiting for real device');
    S.ui.selectedResourceId=r.id;persist(null);go(30);
  }

  function cashDropModal(){
    var open=(S.shifts||[]).find(function(x){return x.status==='OPEN';});if(!open){toast('Open a shift first');return;}
    var root=document.getElementById('modalRoot');if(!root)return;
    root.innerHTML='<div class="modal-backdrop"><section class="modal-sheet v296-sheet"><div class="modal-head"><b>Cash Drop</b><button class="icon-btn" data-v296="close-modal">'+svg('close')+'</button></div><div class="modal-body"><div class="input-wrap"><label>Amount (MAD)</label><input id="v296CashDrop" class="cinput" type="number" min="0" step="0.5"></div><div class="input-wrap"><label>Note</label><input id="v296CashDropNote" class="cinput" placeholder="Safe / bank / manager"></div><button class="cbtn primary block" data-v296="save-cash-drop">Record Cash Drop</button></div></section></div>';
  }
  function saveCashDrop(){
    var open=(S.shifts||[]).find(function(x){return x.status==='OPEN';}),amt=num((document.getElementById('v296CashDrop')||{}).value),note=(document.getElementById('v296CashDropNote')||{}).value||'';
    if(!open||amt<=0){toast('Enter a valid amount');return;}
    S.cashEntries=S.cashEntries||[];
    var x=Object.assign(A.entityBase?A.entityBase(S.scope):{},{id:A.uid('cash'),shiftId:open.id,type:'CASH_DROP',amount:amt,note:note,at:now()});
    S.cashEntries.push(x);open.cashDrops=num(open.cashDrops)+amt;persist('CASH_DROP_RECORDED',{shiftId:open.id,amount:amt});
    closeModal();toast('Cash drop recorded');location.reload();
  }

  function closeModal(){var r=document.getElementById('modalRoot');if(r)r.innerHTML='';S.ui.modal=null;persist(null);}

  function ensurePersistentNav(){
    if(!isOps())return;
    var spec=[
      [42,'Accueil','home'],
      [24,'Joueurs','users'],
      [15,'Sessions','clock'],
      [21,'Caisse','cash'],
      [0,'Plus','more']
    ];
    document.querySelectorAll('.v294-nav,.v293-nav,.v295-nav,.canon-bottomnav').forEach(function(n){if(n.id!=='v296Nav')n.remove();});
    var nav=document.getElementById('v296Nav');
    if(!nav){nav=document.createElement('nav');nav.id='v296Nav';nav.className='v296-nav';document.body.appendChild(nav);}
    var cur=screen(),slot=cur===42?0:[24,25,26,27,28,47,58].indexOf(cur)>=0?1:[15,16,17,18,19,29,30,31,57,59].indexOf(cur)>=0?2:[20,21,22,23,45,48,49,55,60].indexOf(cur)>=0?3:4;
    nav.innerHTML=spec.map(function(x,i){return '<button class="'+(i===slot?'active':'')+'" '+(x[0]?'data-v296="go:'+x[0]+'"':'data-v296="more"')+'>'+svg(x[2])+'<span>'+x[1]+'</span></button>';}).join('');
    document.body.classList.add('v296-has-nav');
    try{
      if(A.native&&A.native.getBottomSystemInsetCssPx){
        var inset=num(A.native.getBottomSystemInsetCssPx(),0);
        if(inset>0)document.documentElement.style.setProperty('--v296-system-bottom',Math.max(12,inset)+'px');
      }
    }catch(_){}
  }

  function moreSheet(){
    closeModal();
    var root=document.getElementById('modalRoot');if(!root)return;
    var groups=[
      ['Exploitation',[[15,'Salle & sessions','game'],[26,'Réservations','calendar'],[27,'File d’attente','queue'],[28,'Tournois','trophy']]],
      ['Ventes',[[20,'POS','cash'],[22,'Snacks & produits','food'],[23,'Ventes assistées','chart'],[25,'Fidélité & passes','users']]],
      ['Pilotage',[[32,'Analytics','chart'],[34,'Multi-site','monitor'],[36,'Équipe & accès','users'],[45,'Finance','cash']]],
      ['Configuration',[[8,'Onboarding','check'],[10,'Plan & équipements','box'],[9,'Tarifs & modèles','cash'],[29,'Appareils','monitor']]],
      ['Système',[[40,'Réglages','settings'],[41,'Sécurité','shield'],[51,'Synchronisation','sync'],[52,'Support','wrench']]]
    ];
    var html='<div class="modal-backdrop v296-more-backdrop"><section class="v296-more"><header><div><b>Plus</b><small>Fonctions organisées par métier</small></div><button data-v296="close-modal">'+svg('close')+'</button></header>';
    groups.forEach(function(g){html+='<div class="v296-more-group"><h3>'+esc(g[0])+'</h3><div>';g[1].forEach(function(x){html+='<button data-v296="go:'+x[0]+'">'+svg(x[2])+'<span>'+esc(x[1])+'</span></button>';});html+='</div></div>';});
    html+='</section></div>';root.innerHTML=html;
  }

  var tabRoutes={
    12:{Live:42,Players:24,Devices:29,Revenue:32,Staff:36,Settings:40},
    18:{'Session History':59},
    21:{History:59,Settings:40},
    24:{Bookings:26,Membership:25},
    26:{'Floor View':15,Resources:15},
    27:{Settings:40},
    28:{Players:24,Settings:40},
    29:{Settings:40},
    30:{Settings:40},
    31:{Settings:40},
    34:{Reports:32},
    35:{Settings:40},
    36:{Security:41},
    38:{Documentation:52},
    41:{'Audit Logs':59}
  };
  function handleTab(label,el){
    var x=screen(),routes=tabRoutes[x]||{};
    if(routes[label]){go(routes[label]);return;}
    V.tabs[String(x)]=label;persist('UI_TAB_CHANGED',{screen:x,tab:label});
    if(x===16){S.ui.consoleBillingMode=label;persist(null);applySessionMode(label);return;}
    if(x===17){
      var want=label==='Snooker'?'SNOOKER_TABLE':'BILLIARD_TABLE',r17=A.resources().find(function(r){return A.resourceType(r)===want;});
      if(!r17){toast(label+' non configuré dans le plan');markActive(el);return;}
      S.ui.selectedResourceId=r17.id;persist('RESOURCE_SELECTED',{resourceId:r17.id,source:'session-tab'});location.reload();return;
    }
    if(x===22){filterProducts(label);return;}
    if(x===15){applyFloorTab(label);return;}
    if(x===20){S.ui.orderContext=label;persist('POS_CONTEXT_CHANGED',{context:label});toast(label);markActive(el);return;}
    if(x===21&&label==='Cash Control'){markActive(el);scrollSection('Cash Control');return;}
    if(x===24&&label==='Activity'){go(59);return;}
    if(x===24&&label==='Notes'){clientNotesModal();return;}
    if(x===25){markActive(el);scrollSection(label);return;}
    if(x===27){markActive(el);filterQueue(label);return;}
    if(x===28){markActive(el);filterTournaments(label);return;}
    if(x===29||x===30){markActive(el);applyDeviceTab(label);return;}
    if(x===31){markActive(el);applyIncidentTab(label);return;}
    if(x===32){markActive(el);applyAnalyticsTab(label);return;}
    if(x===34){
      markActive(el);
      if(label==='My Venues')scrollSection('My Venues');
      else if(label==='Alerts')go(31);
      else toast(label);
      return;
    }
    if(x===35){markActive(el);if(label==='Organization')scrollSection('Organization');else if(label==='Policies')scrollSection('Policies');else toast(label);return;}
    if(x===36){markActive(el);if(label==='Roles'||label==='Permissions')scrollSection('Permission');else toast(label);return;}
    if(x===38){markActive(el);if(label==='Webhooks')scrollSection('Webhooks');else if(label==='Integrations')scrollSection('Integrations');else toast(label);return;}
    if(x===39){markActive(el);scrollSection(label);return;}
    if(x===41){markActive(el);if(label==='Risk Monitor')go(31);else if(label==='Owner Sentinel')scrollSection('Owner Sentinel');else toast(label);return;}
    markActive(el);toast(label);
  }
  function scrollSection(label){
    var q=String(label||'').toLowerCase(),els=document.querySelectorAll('.section-title,h2,h3,.cardHead h3,.card-head h3');
    var hit=Array.from(els).find(function(x){return String(x.textContent||'').toLowerCase().indexOf(q.split(' ')[0])>=0;});
    if(hit){hit.scrollIntoView({behavior:'smooth',block:'start'});return;}
    toast(label);
  }
  function markActive(el){var p=el&&el.parentElement;if(!p)return;p.querySelectorAll('button').forEach(function(b){b.classList.remove('active');});el.classList.add('active');}
  function applySessionMode(label){
    var mode={Time:'fixed',Budget:'budget',Fixed:'fixed',Open:'open'}[label]||'fixed';
    document.querySelectorAll('[data-action^="start-console:"]').forEach(function(b){var p=b.dataset.action.split(':');b.dataset.action=[p[0],p[1]||'60',p[2]||'1',mode].join(':');});
    if(mode==='budget'){
      var target=document.querySelector('.option-grid,.grid3');
      if(target&&!document.getElementById('v296Budget')){
        var box=document.createElement('div');box.className='v296-budget';box.innerHTML='<label>Budget client (MAD)</label><input id="v296Budget" type="number" min="1" step="1" value="20">';
        target.parentNode.insertBefore(box,target);
      }
    }else{var b=document.getElementById('v296Budget');if(b&&b.parentNode)b.parentNode.remove();}
    document.querySelectorAll('.tabs .tab,.canon-tabs button').forEach(function(t){if((t.textContent||'').trim()===label)markActive(t);});
  }
  function applyFloorTab(label){
    markActive(Array.from(document.querySelectorAll('.tabs .tab,.canon-tabs button')).find(function(x){return (x.textContent||'').trim()===label;}));
    var grid=document.querySelector('.resource-grid,.floor');
    if(!grid)return;
    if(label==='List')grid.classList.add('v296-list-mode');else grid.classList.remove('v296-list-mode');
    if(label==='Map'){go(10);return;}
    if(label==='Filters'){openResourceFilter();return;}
  }
  function openResourceFilter(){
    var root=document.getElementById('modalRoot');if(!root)return;
    root.innerHTML='<div class="modal-backdrop"><section class="modal-sheet v296-sheet"><div class="modal-head"><b>Filter Floor</b><button class="icon-btn" data-v296="close-modal">'+svg('close')+'</button></div><div class="modal-body"><button class="cbtn outline block" data-v296="floor-filter:ALL">All resources</button><button class="cbtn outline block" data-v296="floor-filter:FREE">Available only</button><button class="cbtn outline block" data-v296="floor-filter:BUSY">In use only</button><button class="cbtn outline block" data-v296="floor-filter:CONSOLE">PS5 / Console</button><button class="cbtn outline block" data-v296="floor-filter:SIM_RACING">SIM Racing</button><button class="cbtn outline block" data-v296="floor-filter:BILLIARD_TABLE">Billiard</button></div></section></div>';
  }
  function applyFloorFilter(f){
    V.filters.floor=f;persist('FLOOR_FILTER_CHANGED',{filter:f});closeModal();location.reload();
  }
  function filterFloorCards(){
    var f=V.filters.floor||'ALL';if(screen()!==15||f==='ALL')return;
    var rs=A.resources(),els=document.querySelectorAll('.resource,.station');
    els.forEach(function(el){
      var title=(el.querySelector('b,h4')||{}).textContent||'',r=rs.find(function(x){return x.name===title;});if(!r)return;
      var busy=!!A.sessionFor(r.id),show=f==='FREE'?!busy:f==='BUSY'?busy:A.resourceType(r)===f;el.style.display=show?'':'none';
    });
  }
  function filterProducts(label){
    markActive(Array.from(document.querySelectorAll('.tabs .tab,.canon-tabs button')).find(function(x){return (x.textContent||'').trim()===label;}));
    var cards=document.querySelectorAll('.catalog .product');
    cards.forEach(function(c){
      var txt=(c.textContent||'').toLowerCase(),show=label==='All Items'||(label==='Food & Beverage'&&/coca|red bull|twix|oreo|lays|snicker|water|eau|fanta|sprite|drink|snack/.test(txt))||(label==='Gaming'&&/pass|gaming|controller|headset/.test(txt))||(label==='Merch'&&/cap|shirt|mouse/.test(txt))||(label==='Services'&&/service|hour|pass/.test(txt));
      c.style.display=show?'':'none';
    });
  }
  function filterQueue(label){
    var old=document.querySelector('.v296-queue-panel');if(old)old.remove();
    if(label==='Queue')return;
    var tabs=document.querySelector('.canon-tabs,.tabs'),panel=document.createElement('section');panel.className='canon-card pad v296-queue-panel';
    if(label==='Waitlist'){
      var xs=S.waitlist||[];
      panel.innerHTML='<h3>Waitlist</h3><div class="row-list">'+(xs.length?xs.map(function(x,i){return row('queue',(i+1)+'. '+(x.name||'Client'),x.requestedType||'Any resource',statusBadge(x.status||'WAITING','amber'));}).join(''):'<div class="truth-empty"><b>Waitlist empty</b><small>No future waiting player.</small></div>')+'</div>';
    }else if(label==='Notifications'){
      panel.innerHTML='<h3>Notifications</h3><p class="canon-sub">Queue notifications are generated only from real waiting records and available resources.</p><div class="row-list">'+((S.queue||[]).length?row('bell','Players waiting',String(S.queue.length)+' in live queue',statusBadge('ACTION','amber')):'<div class="truth-empty"><b>No notification</b><small>Nothing needs attention.</small></div>')+'</div>';
    }
    if(tabs&&tabs.parentNode)tabs.parentNode.insertBefore(panel,tabs.nextSibling);
  }
  function filterTournaments(label){
    if(label==='Tournaments'||label==='Upcoming')return;
    toast(label+' · '+(S.tournaments||[]).filter(function(t){return String(t.status||'').toLowerCase().indexOf(label.toLowerCase().split(' ')[0])>=0;}).length);
  }
  function applyDeviceTab(label){
    if(label==='Pairing'){scrollSection('Pair Device');return;}
    if(label==='Overlay'){scrollSection('Overlay Status');return;}
    if(label==='Locations'){scrollSection('Location View');return;}
    if(label==='Monitors'){scrollSection('Fleet Health');return;}
    if(label==='Devices'){window.scrollTo({top:0,behavior:'smooth'});return;}
  }
  function applyIncidentTab(label){
    if(label==='Maintenance'){document.querySelectorAll('.crow').forEach(function(r){var txt=(r.textContent||'').toLowerCase();r.style.display=/maintenance|clean|part/.test(txt)?'':'none';});}
    else if(label==='Tickets'){toast((S.incidents||[]).length+' tickets');}
    else document.querySelectorAll('.crow').forEach(function(r){r.style.display='';});
  }
  function applyAnalyticsTab(label){
    var card=document.querySelector('.v296-analytics-context');if(card)card.remove();
    var data={Revenue:[money(A.revenueToday()),'Paid revenue today'],Players:[String((S.clients||[]).length),'Identified CRM players'],Occupancy:[Math.round(A.activeSessions().length/Math.max(1,A.resources().length)*100)+'%','Live resources'],Engagement:[String((S.memberships||[]).length),'Membership records'],Devices:[String((S.devices||[]).length),'Paired device records']}[label];
    if(!data)return;
    var div=document.createElement('div');div.className='canon-card pad v296-analytics-context';div.innerHTML='<div class="status-line"><b>'+esc(label)+'</b><strong>'+esc(data[0])+'</strong></div><p class="canon-sub">'+esc(data[1])+'</p>';
    var tabs=document.querySelector('.canon-tabs,.tabs');if(tabs&&tabs.parentNode)tabs.parentNode.insertBefore(div,tabs.nextSibling);
  }
  function clientNotesModal(){
    var c=(S.clients||[]).find(function(x){return x.id===S.ui.selectedClientId;})||(S.clients||[])[0];if(!c){toast('Select a client first');return;}
    var root=document.getElementById('modalRoot');root.innerHTML='<div class="modal-backdrop"><section class="modal-sheet v296-sheet"><div class="modal-head"><b>Notes · '+esc(c.name)+'</b><button class="icon-btn" data-v296="close-modal">'+svg('close')+'</button></div><div class="modal-body"><textarea id="v296ClientNotes" class="ctextarea" rows="6">'+esc(c.notes||'')+'</textarea><button class="cbtn primary block" data-v296="save-client-notes:'+esc(c.id)+'">Save Notes</button></div></section></div>';
  }

  function saveClientNotes(id){
    var c=(S.clients||[]).find(function(x){return x.id===id;});if(!c)return;c.notes=(document.getElementById('v296ClientNotes')||{}).value||'';persist('CLIENT_NOTES_UPDATED',{clientId:id});closeModal();toast('Notes saved');
  }

  function settingsLinks(){
    if(screen()!==40||document.querySelector('.v296-settings-links'))return;
    var host=document.querySelector('.canon-screen');if(!host)return;
    var sec=document.createElement('section');sec.className='canon-card pad v296-settings-links';
    sec.innerHTML='<div class="section-title v296-settings-title">Configuration de la salle</div><p class="canon-sub">Les mêmes données alimentent le plan, les sessions, les réservations et les appareils.</p><div class="v296-settings-grid"><button data-v296="go:8">'+svg('check')+'<span>Onboarding</span></button><button data-v296="go:10">'+svg('box')+'<span>Plan & équipements</span></button><button data-v296="go:9">'+svg('cash')+'<span>Tarifs & modèles</span></button><button data-v296="go:29">'+svg('monitor')+'<span>Appareils</span></button></div>';
    host.appendChild(sec);
  }
  function iconForText(txt){
    txt=String(txt||'').toLowerCase();
    if(/cash|revenue|payment|caisse|price|tarif/.test(txt))return 'cash';
    if(/player|client|team|staff|member|joueur/.test(txt))return 'users';
    if(/time|session|extend|duration|history|heure|min/.test(txt))return 'clock';
    if(/bill|snooker/.test(txt))return 'billiard';
    if(/sim|racing/.test(txt))return 'sim';
    if(/device|pc|monitor|console/.test(txt))return 'monitor';
    if(/food|drink|snack|f&b/.test(txt))return 'food';
    if(/security|audit|secure/.test(txt))return 'shield';
    if(/booking|calendar|reservation/.test(txt))return 'calendar';
    if(/queue|wait/.test(txt))return 'queue';
    if(/tournament|bracket|winner/.test(txt))return 'trophy';
    return 'game';
  }
  function scrubButtonEmoji(){
    if(!isOps())return;
    document.querySelectorAll('button').forEach(function(b){
      if(b.querySelector('.v296-icon'))return;
      var txt=(b.textContent||'').trim();
      if(!/[\u{1F300}-\u{1FAFF}]/u.test(txt))return;
      var clean=txt.replace(/[\u{1F300}-\u{1FAFF}]/gu,'').replace(/\s+/g,' ').trim();
      b.innerHTML=svg(iconForText(txt))+'<span>'+esc(clean)+'</span>';
      b.classList.add('v296-icon-button');
    });
  }

  function patchButtons(){
    if(!isOps())return;
    if(screen()===19){
      var opts=document.querySelectorAll('.option-grid .option');
      if(opts[1])opts[1].setAttribute('data-v296','extend-selected:60');
      if(opts[2])opts[2].setAttribute('data-v296','extend-selected:120');
      document.querySelectorAll('.row-list .cbtn:not([data-action])').forEach(function(b){b.setAttribute('data-v296','open-snacks');});
    }
    if(screen()===21){
      document.querySelectorAll('button').forEach(function(b){if((b.textContent||'').trim()==='Make Cash Drop'){b.removeAttribute('data-action');b.setAttribute('data-v296','cash-drop');}});
    }
    if(screen()===24){
      document.querySelectorAll('[data-action="add-client"]').forEach(function(b){b.dataset.action='new-client';});
    }
    if(screen()===26){
      document.querySelectorAll('[data-action="new-booking"]').forEach(function(b){b.removeAttribute('data-action');b.setAttribute('data-v296','new-booking');});
    }
    if(screen()===30){
      document.querySelectorAll('[data-action="pair-device"]').forEach(function(b){b.removeAttribute('data-action');var r=A.resources().find(function(x){return x.id===S.ui.selectedResourceId;})||A.resources()[0];if(r)b.setAttribute('data-v296','pair-resource:'+r.id);});
    }
    document.querySelectorAll('[data-go="12"]').forEach(function(el){el.dataset.go='42';});
  }
  function patchSessionNotes(){
    if(screen()!==18)return;
    var s=(S.sessions||[]).find(function(x){return x.id===S.ui.selectedSessionId;})||A.activeSessions()[0],ta=document.querySelector('textarea.ctextarea');
    if(!s||!ta)return;
    ta.value=(s.notes&&s.notes.length)?String(s.notes[s.notes.length-1]||''):'';
    ta.id='v296SessionNote';
    ta.addEventListener('change',function(){s.notes=[ta.value];persist('SESSION_NOTE_UPDATED',{sessionId:s.id});toast('Note saved');});
  }
  function patchMedia(){
    document.querySelectorAll('.product').forEach(function(card){
      var name=(card.querySelector('b')||{}).textContent||'',p=(S.products||[]).find(function(x){return x.name===name;}),art=card.querySelector('.product-img,.productArt');
      if(art&&p){art.style.backgroundImage='url("'+productImage(p)+'")';art.style.backgroundSize='contain';art.style.backgroundRepeat='no-repeat';art.style.backgroundPosition='center';art.textContent='';}
    });
    document.querySelectorAll('.resource').forEach(function(card){
      var name=(card.querySelector('b')||{}).textContent||'',r=A.resources().find(function(x){return x.name===name;}),art=card.querySelector('.resource-img');
      if(art&&r){art.style.backgroundImage='url("'+resourceImage(r)+'")';art.style.backgroundSize='contain';art.style.backgroundRepeat='no-repeat';art.style.backgroundPosition='center';}
    });
  }
  function scrubEmojiIcons(){
    if(!isOps())return;
    document.querySelectorAll('.row-icon,.kpi-icon,.offer-icon,.stateIcon,.step-icon').forEach(function(el){
      var txt=(el.textContent||'').trim();if(!txt||!/[^\x00-\x7F]/.test(txt))return;
      var all=((el.parentElement&&el.parentElement.textContent)||'').toLowerCase(),k=/cash|revenue|payment|caisse/.test(all)?'cash':/player|client|team|staff|member/.test(all)?'users':/session|time|clock|duration/.test(all)?'clock':/bill|snooker/.test(all)?'billiard':/sim|racing/.test(all)?'sim':/device|pc|monitor/.test(all)?'monitor':/food|drink|snack/.test(all)?'food':/security|audit/.test(all)?'shield':'game';
      el.innerHTML=svg(k);
    });
  }

  function openSnacksForSelected(){
    var s=(S.sessions||[]).find(function(x){return x.id===S.ui.selectedSessionId;})||A.activeSessions()[0];if(!s){toast('No active session');return;}
    var root=document.getElementById('modalRoot');root.innerHTML='<div class="modal-backdrop"><section class="modal-sheet v296-sheet"><div class="modal-head"><b>Add to Session</b><button class="icon-btn" data-v296="close-modal">'+svg('close')+'</button></div><div class="modal-body"><div class="v296-product-grid">'+(S.products||[]).filter(function(p){return p.enabled!==false&&num(p.stock)>0;}).map(function(p){return '<button data-v296="sell-snack:'+s.id+':'+p.id+'"><img src="'+productImage(p)+'" alt=""><b>'+esc(p.name)+'</b><span>'+money(p.price)+'</span></button>';}).join('')+'</div></div></section></div>';
  }

  function extendSelected(minutes){
    var s=(S.sessions||[]).find(function(x){return x.id===S.ui.selectedSessionId;})||A.activeSessions()[0];if(!s){toast('No active session');return;}
    if(s.billingMode==='per_game'){toast('Use +1 game for billiard');return;}
    var count=Math.max(1,Math.round(minutes/30)),sum=0;for(var i=0;i<count;i++)sum+=num(A.extend30(s.id,false));
    toast('+'+minutes+' min · '+money(sum));location.reload();
  }

  function startBudgetIntercept(el){
    var a=el.dataset.action||'',p=a.split(':');if(p[0]!=='start-console'||p[3]!=='budget')return false;
    var rid=S.ui.selectedResourceId,r=A.resources().find(function(x){return x.id===rid;})||A.resources().find(function(x){return A.resourceType(x)==='CONSOLE'&&!A.sessionFor(x.id);});
    var budget=num((document.getElementById('v296Budget')||{}).value,20),players=num(p[2],1);
    if(!r||budget<=0){toast('Choose a free console and a valid budget');return true;}
    var res=A.startTimed(r.id,0,players,'budget',budget);
    if(res&&res.ok){S.ui.selectedSessionId=res.session.id;persist(null);toast('Budget session started');go(18);}else toast('Resource unavailable');
    return true;
  }

  function handleAction(a,el){
    var p=a.split(':'),k=p[0];
    if(k==='go'){go(p[1]);return true;}
    if(k==='more'){moreSheet();return true;}
    if(k==='close-modal'){closeModal();return true;}
    if(k==='new-booking'){createBookingModal();return true;}
    if(k==='save-booking'){saveBooking();return true;}
    if(k==='resource-device'){S.ui.selectedResourceId=p[1];persist(null);go(30);return true;}
    if(k==='pair-resource'){pairingModal(p[1]);return true;}
    if(k==='create-pairing'){createPairing(p[1]);return true;}
    if(k==='cash-drop'){cashDropModal();return true;}
    if(k==='save-cash-drop'){saveCashDrop();return true;}
    if(k==='extend-selected'){extendSelected(num(p[1],30));return true;}
    if(k==='open-snacks'){openSnacksForSelected();return true;}
    if(k==='floor-filter'){applyFloorFilter(p[1]);return true;}
    if(k==='save-client-notes'){saveClientNotes(p[1]);return true;}
    if(k==='sell-snack'){
      var d=A.addSnack(p[1],p[2],1,false);toast(d?'Added · '+money(d):'Stock unavailable');if(d){closeModal();location.reload();}return true;
    }
    return false;
  }

  function enhance(){
    normalizeGraph();
    ensurePersistentNav();
    patchButtons();
    patchSessionNotes();
    patchMedia();
    scrubEmojiIcons();
    scrubButtonEmoji();
    settingsLinks();
    filterFloorCards();
    var active=V.tabs[String(screen())];
    if(screen()===16&&active)applySessionMode(active);
    if(screen()===22&&active)filterProducts(active);
    document.body.dataset.v296='ready';
  }

  registerDeviceScreens();

  document.addEventListener('click',function(ev){
    var tab=ev.target&&ev.target.closest?ev.target.closest('[data-v296-tab],.tabs .tab,.canon-tabs button'):null;
    if(tab&&isOps()){
      var label=(tab.getAttribute('data-v296-tab')||tab.textContent||'').trim();
      if(label){ev.preventDefault();ev.stopImmediatePropagation();handleTab(label,tab);return;}
    }
    var v=ev.target&&ev.target.closest?ev.target.closest('[data-v296]'):null;
    if(v){ev.preventDefault();ev.stopImmediatePropagation();handleAction(v.getAttribute('data-v296')||'',v);return;}
    var moduleMenu=ev.target&&ev.target.closest?ev.target.closest('[data-action="module-menu"]'):null;
    if(moduleMenu&&isOps()){ev.preventDefault();ev.stopImmediatePropagation();moreSheet();return;}
    var act=ev.target&&ev.target.closest?ev.target.closest('[data-action^="start-console:"]'):null;
    if(act&&startBudgetIntercept(act)){ev.preventDefault();ev.stopImmediatePropagation();return;}
  },true);

  var mo=new MutationObserver(function(){clearTimeout(window.__v296Enhance);window.__v296Enhance=setTimeout(enhance,20);});
  if(document.getElementById('app'))mo.observe(document.getElementById('app'),{childList:true,subtree:true});
  if(document.getElementById('modalRoot'))mo.observe(document.getElementById('modalRoot'),{childList:true,subtree:true});

  window.addEventListener('resize',function(){ensurePersistentNav();});
  setTimeout(enhance,0);
})();
