'use strict';
(function(){
  var A=window.LPOS,U=window.LPOSScreens,S=A&&A.state;
  if(!A||!U||!S)return;
  var M='../media/',P=M+'premium/',PR=M+'products/';
  function e(v){return U.esc(v==null?'':v);}
  function n(v,d){var x=Number(v);return Number.isFinite(x)?x:(d||0);}
  function money(v){return A.money?A.money(v):(Math.round(n(v)*100)/100)+' MAD';}
  function escAttr(v){return e(v).replace(/"/g,'&quot;');}
  function ico(k,cls){var p={
    user:'<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2.5 20c.4-4.2 2.4-6 5.5-6s5.1 1.8 5.5 6M10.5 20c.4-3.6 2.2-5.2 5.3-5.2s4.9 1.6 5.2 5.2"/>',
    game:'<path d="M7 9h10c3.2 0 5 2.2 5 5.2l-1 3.6c-.4 1.6-2 2.3-3.3 1.3L15 17H9l-2.7 2.1C5 20.1 3.4 19.4 3 17.8l-1-3.6C2 11.2 3.8 9 7 9z"/><path d="M7 12v4M5 14h4M16 13h.01M19 16h.01"/>',
    chart:'<path d="M5 20V11M10 20V5M15 20v-7M20 20V8"/>',
    coins:'<ellipse cx="8" cy="7" rx="5" ry="2.5"/><path d="M3 7v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7M3 11v4c0 1.4 2.2 2.5 5 2.5 1.5 0 2.8-.3 3.7-.8"/><ellipse cx="17" cy="15" rx="4" ry="2"/><path d="M13 15v3c0 1.1 1.8 2 4 2s4-.9 4-2v-3"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
    cup:'<path d="M6 7h10l-1 13H7zM16 9h2.2a2.8 2.8 0 0 1 0 5.6H16M8 4h6"/>',
    play:'<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
    stop:'<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
    home:'<path d="m3 11 9-7 9 7v9H6v-9"/><path d="M9 20v-6h6v6"/>',
    devices:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    more:'<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
    building:'<path d="M5 21V4h11v17M16 9h4v12M8 8h2M12 8h2M8 12h2M12 12h2M8 16h2M12 16h2M3 21h19"/>',
    pin:'<path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11z"/><circle cx="12" cy="10" r="2"/>',
    pulse:'<path d="M2 13h4l2-6 4 11 3-8 2 3h5"/>',
    star:'<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="currentColor" stroke="none"/>',
    bulb:'<path d="M9 18h6M10 21h4M8 15c-1.4-1.1-2.2-2.8-2.2-4.7A6.2 6.2 0 0 1 12 4a6.2 6.2 0 0 1 6.2 6.3c0 1.9-.8 3.6-2.2 4.7-.8.7-1.1 1.5-1.2 2H9.2c-.1-.5-.4-1.3-1.2-2z"/>',
    chevron:'<path d="m9 5 7 7-7 7"/>',
    down:'<path d="m7 9 5 5 5-5"/>'
  };return '<svg class="v292-icon '+e(cls||'')+'" viewBox="0 0 24 24" aria-hidden="true">'+(p[k]||p.game)+'</svg>';}
  function dayKey(ts){try{return new Date(ts||0).toLocaleDateString('sv-SE',{timeZone:(S.business&&S.business.timezone)||'Africa/Casablanca'});}catch(_){return new Date(ts||0).toISOString().slice(0,10);}}
  function today(){return dayKey(A.now());}
  function isToday(ts){return !!ts&&dayKey(ts)===today();}
  function resourceState(r){var session=A.sessionFor(r.id),st=String(r.status||'').toUpperCase();if(st==='MAINTENANCE'||st==='ERROR'||st==='OFFLINE')return {label:st==='MAINTENANCE'?'Maintenance':st==='OFFLINE'?'Offline':'Issue',cls:'danger',session:null};if(session)return {label:'In Use',cls:'busy',session:session};return {label:'Available',cls:'available',session:null};}
  function avgSessionMinutes(){var xs=(S.sessions||[]).filter(function(s){return s&&s.startAt&&(isToday(s.startAt)||String(s.status).toLowerCase()==='active');});if(!xs.length)return 0;var total=xs.reduce(function(sum,s){var end=s.finishedAt||s.endAt||(String(s.status).toLowerCase()==='active'?A.now():s.startAt);return sum+Math.max(0,(n(end)-n(s.startAt))/60000);},0);return Math.round(total/xs.length);}
  function fmtDuration(mins){mins=Math.max(0,n(mins));if(!mins)return '—';var h=Math.floor(mins/60),m=Math.round(mins%60);return h?(h+'h '+String(m).padStart(2,'0')+'m'):(m+'m');}
  function snackStats(){var rev=0,items=0;(S.sales||[]).forEach(function(x){if(isToday(x.at||x.createdAt)){rev+=n(x.total);items+=n(x.qty,1);}});(S.orders||[]).forEach(function(o){if(!isToday(o.at||o.createdAt)||String(o.status||'PAID').toUpperCase()!=='PAID')return;(o.lines||[]).forEach(function(l){rev+=n(l.price)*n(l.qty,1);items+=n(l.qty,1);});});return {revenue:rev,items:items};}
  function productImage(p){var x=String((p&&p.name)||'').toLowerCase();if(x.indexOf('coca')>=0||x.indexOf('cola')>=0)return PR+'cocacola.jpg';if(x.indexOf('red bull')>=0||x.indexOf('redbull')>=0)return PR+'redbull.jpg';if(x.indexOf('snicker')>=0)return PR+'snickers.jpg';if(x.indexOf('twix')>=0)return PR+'twix.jpg';if(x.indexOf('pring')>=0||x.indexOf('lays')>=0||x.indexOf('chip')>=0)return PR+'lays.jpg';if(x.indexOf('oreo')>=0)return PR+'oreo.jpg';if(x.indexOf('fanta')>=0)return PR+'fanta.jpg';if(x.indexOf('sprite')>=0)return PR+'sprite.jpg';if(x.indexOf('water')>=0||x.indexOf('eau')>=0)return PR+'water.svg';return String(p&&p.category||'').toUpperCase()==='DRINK'?PR+'cola.svg':PR+'chocolate.svg';}
  function groupDefinitions(){return [
    {key:'CONSOLE',label:'PS5',types:['CONSOLE'],img:P+'ps5.jpg',unit:'stations'},
    {key:'SIM_RACING',label:'SIM Racing',types:['SIM_RACING'],img:P+'sim.jpg',unit:'rigs'},
    {key:'PC_GAMING',label:'PC Gaming',types:['PC_GAMING'],img:P+'pc.jpg',unit:'stations'},
    {key:'BILLIARD',label:'Billiard',types:['BILLIARD_TABLE','SNOOKER_TABLE'],img:P+'billiard.jpg',unit:'tables'}
  ];}
  function getGroups(rs){var defs=groupDefinitions(),used={};var groups=defs.map(function(g){var items=rs.filter(function(r){var t=A.resourceType(r);if(g.types.indexOf(t)>=0){used[r.id]=1;return true;}return false;});return Object.assign({},g,{items:items});});var other=rs.filter(function(r){return !used[r.id];});if(other.length)groups.push({key:'OTHER',label:'Other',types:[],img:P+'arcade.jpg',unit:'resources',items:other});return groups;}
  function statusChip(r){var st=resourceState(r),action=st.session?'data-action="session:'+escAttr(st.session.id)+'"':(st.cls==='danger'?'data-go="31"':'data-action="choose-resource:'+escAttr(r.id)+'"');return '<button class="v292-station-chip '+st.cls+'" '+action+'><b>'+e(r.name)+'</b><span><i></i>'+e(st.label)+'</span></button>';}
  function categoryCard(g){return '<button class="v292-category" data-v292="category:'+e(g.key)+'"><img src="'+e(g.img)+'" alt=""><div><b>'+e(g.label)+'</b><span>'+g.items.length+' '+e(g.unit)+'</span></div>'+ico('chevron')+'</button>';}
  function liveRow(g){var inUse=g.items.filter(function(r){return !!A.sessionFor(r.id);}).length;var chips=g.items.length?g.items.slice(0,6).map(statusChip).join(''):'<div class="v292-empty-chips">No stations</div>';return '<div class="v292-live-row"><div class="v292-live-left"><img src="'+e(g.img)+'" alt=""><div><b>'+e(g.label)+'</b><span>'+g.items.length+' '+e(g.unit)+'</span></div></div><div class="v292-live-chips">'+chips+'</div></div>';}
  function snackCard(p){return '<button class="v292-product" data-v292="product:'+e(p.id)+'"><img src="'+e(productImage(p))+'" alt=""><b>'+e(p.name)+'</b><span>'+n(p.stock)+' in stock</span></button>';}
  function emptySnack(i){var fallback=[['Coca-Cola',PR+'cocacola.jpg'],['Water',PR+'water.svg'],['Red Bull',PR+'redbull.jpg'],['Pringles',PR+'lays.jpg'],['Snickers',PR+'snickers.jpg']][i]||['Product',PR+'chocolate.svg'];return '<div class="v292-product muted"><img src="'+fallback[1]+'" alt=""><b>'+e(fallback[0])+'</b><span>Not set</span></div>';}
  function kpi(icon,label,value,sub,accent){return '<div class="v292-kpi '+(accent||'')+'"><span class="v292-kpi-icon">'+ico(icon)+'</span><div><small>'+e(label)+'</small><strong>'+e(value)+'</strong><em>'+e(sub||'')+'</em></div></div>';}
  function nav(){return '<nav class="v292-nav"><button class="active" data-go="42">'+ico('home')+'<span>Home</span></button><button data-go="24">'+ico('user')+'<span>Players</span></button><button data-go="29">'+ico('devices')+'<span>Devices</span></button><button data-go="40">'+ico('more')+'<span>More</span></button></nav>';}
  function venueName(){var v=(S.venues||[])[0];return (v&&v.name)||(S.business&&S.business.name)||'LA PAUSE CLUB';}
  function locationText(){var v=(S.venues||[])[0]||{},city=v.city||'',country=v.country||'';return [city,country].filter(Boolean).join(', ')||'Venue location';}
  function screen42(){
    var rs=A.resources(),active=A.activeSessions(),groups=getGroups(rs),players=active.reduce(function(a,s){return a+Math.max(1,n(s.players,1));},0),occ=rs.length?Math.round(active.length/rs.length*100):0,sn=snackStats(),avg=avgSessionMinutes(),venue=(S.venues||[])[0]||{},branch=(S.branches||[])[0]||{},products=(S.products||[]).filter(function(p){return p.enabled!==false;}).slice(0,5),slots='';
    for(var i=0;i<5;i++)slots+=products[i]?snackCard(products[i]):emptySnack(i);
    var busiest=groups.reduce(function(best,g){if(!g.items.length)return best;var use=g.items.filter(function(r){return !!A.sessionFor(r.id);}).length,rate=Math.round(use/g.items.length*100);return !best||rate>best.rate?{label:g.label,rate:rate}:best;},null)||{label:'—',rate:0};
    var online=String(venue.status||'').toUpperCase()==='ONLINE',hours=(S.business&&S.business.openingHours)||'10:00 – 00:00';
    return '<div class="v292-home">'+
      '<header class="v292-header"><div class="v292-brand"><div class="brand-mark"></div><div><b>LA PAUSE <span>OS</span></b><small>GAMING VENUES. SIMPLIFIED.</small></div></div><button class="v292-venue-switch" data-go="7">'+ico('building')+'<span>'+e(venueName())+'</span>'+ico('down')+'</button><div class="v292-operator"><div>OP<i></i></div><small>Operator</small></div></header>'+
      '<section class="v292-hero"><div class="v292-hero-bg" style="background-image:linear-gradient(90deg,rgba(2,13,27,.98) 0%,rgba(2,13,27,.84) 42%,rgba(2,13,27,.15) 78%),url(\''+M+'esport-dynamic.png\')"></div><div class="v292-hero-top"><div class="v292-live"><i></i>'+(online?'Open Now':'Local')+'</div><span>'+e(branch.name||'Main Floor')+'</span><h1>'+e(venueName())+'</h1><p>More than gaming. A better place to be.</p><div class="v292-meta"><span>'+ico('pin')+e(locationText())+'</span><span>'+ico('clock')+'Open '+e(hours)+'</span></div></div><div class="v292-kpis">'+
        kpi('user','Live Players',String(players),players?'right now':'no active players')+
        kpi('game','Active Stations',active.length+' / '+rs.length,occ+'% in use')+
        kpi('user','Occupancy Rate',occ+'%',rs.length?'live utilization':'no resources')+
        kpi('coins','Today Revenue',money(A.revenueToday()),'today')+
        kpi('clock','Avg Session Time',fmtDuration(avg),avg?'today':'no sessions')+
        kpi('cup','Snack Sales Today',money(sn.revenue),sn.items+' items sold')+
      '</div></section>'+
      '<section class="v292-actions"><button class="start" data-action="quick-session">'+ico('play')+'<div><b>Start Session</b><span>New player session</span></div></button><button class="end" data-v292="end-session">'+ico('stop')+'<div><b>End Session</b><span>Close active session</span></div></button><button class="extend" data-v292="extend-session">'+ico('clock')+'<div><b>Extend Time</b><span>Add more time</span></div></button></section>'+
      '<section class="v292-section"><h2>'+ico('game')+'Game Categories</h2><div class="v292-categories">'+groups.map(categoryCard).join('')+'</div></section>'+
      '<section class="v292-section v292-live-section"><h2>'+ico('pulse')+'Live Stations <small>Real-time status by category</small></h2><div class="v292-live-list">'+groups.map(liveRow).join('')+'</div></section>'+
      '<section class="v292-section v292-snacks"><div class="v292-section-head"><h2>'+ico('cup')+'Snacks & Drinks</h2><div><span>'+sn.items+' items sold today</span><b>'+money(sn.revenue)+'</b></div></div><div class="v292-products">'+slots+'</div></section>'+
      '<section class="v292-insight" data-go="14"><span class="star">'+ico('star')+'</span><div><b>Busiest category right now: '+e(busiest.label)+'</b><small>'+busiest.rate+'% occupancy'+(busiest.rate?' — Live venue signal':' — No active demand yet')+'</small></div><i></i><span class="bulb">'+ico('bulb')+'</span><div><b>Tip:</b><small>'+e(active.length>=rs.length&&rs.length?'Capacity is full. Prepare the next free station.':'Use Next Best Action for the next revenue opportunity.')+'</small></div>'+ico('chevron')+'</section>'+
      nav()+'</div>';
  }
  U.register(42,screen42);
  document.addEventListener('click',function(ev){var el=ev.target&&ev.target.closest?ev.target.closest('[data-v292]'):null;if(!el)return;var a=el.getAttribute('data-v292')||'';ev.preventDefault();ev.stopImmediatePropagation();if(a.indexOf('category:')===0){var key=a.split(':')[1];S.ui=S.ui||{};S.ui.resourceTypeFilter=key;A.persist(null);A.setScreen(15);location.reload();return;}if(a.indexOf('product:')===0){S.ui=S.ui||{};S.ui.selectedProductId=a.split(':')[1];A.persist(null);A.setScreen(20);location.reload();return;}if(a==='end-session'||a==='extend-session'){var act=A.activeSessions();if(!act.length){A.setScreen(15);location.reload();return;}S.ui.selectedSessionId=act[0].id;A.persist(null);A.setScreen(18);location.reload();return;}},true);
})();
