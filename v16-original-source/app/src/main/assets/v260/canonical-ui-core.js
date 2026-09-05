'use strict';
(function(){
  var A=window.LPOS,M=window.LPOSMedia,S=A.state,REG={};
  function e(v){return String(v==null?'':v).replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];});}
  function logo(){return '<div class="brand"><div class="brandMark"></div><div class="brandText">LA PAUSE <span>OS</span></div></div>';}
  function top(extra){return '<div class="topBrand">'+logo()+'<div style="display:flex;align-items:center;gap:7px">'+(extra||'')+'<button class="lang" data-action="language">◉ '+e((S.ui.language||'EN').toUpperCase())+'⌄</button></div></div>';}
  function btn(label,action,cls){return '<button class="btn '+(cls||'')+'" data-action="'+e(action)+'">'+label+'</button>';}
  function badge(text,cls){return '<span class="badge '+(cls||'')+'">'+text+'</span>';}
  function panel(title,body,side,cls){return '<section class="panel '+(cls||'')+'"><div class="panelHead"><h3>'+title+'</h3>'+(side||'')+'</div><div class="panelBody">'+body+'</div></section>';}
  function kpi(label,value,delta,cls){return '<div class="kpi '+(cls||'')+'"><small>'+label+'</small><strong>'+value+'</strong><em>'+ (delta||'') +'</em></div>';}
  function tabs(items,active){return '<div class="tabs">'+items.map(function(x){return '<button class="tab '+(x===active?'active':'')+'">'+x+'</button>';}).join('')+'</div>';}
  function row(title,sub,right,selected){return '<div class="listRow '+(selected?'selectedRow':'')+'"><div><strong>'+title+'</strong><small>'+sub+'</small></div><div class="right">'+right+'</div></div>';}
  function media(src,alt,cls){return '<div class="heroMedia '+(cls||'')+'"><img src="'+e(src)+'" alt="'+e(alt||'')+'" draggable="false"></div>';}
  function productCard(p){var src=M.product(p);return '<div class="productCard"><img src="'+e(src)+'" alt="'+e(p.name)+'"><div class="pMeta"><strong>'+e(p.name)+'</strong><small>'+e(p.category||'Product')+'</small><div class="pPrice">'+A.money(p.price)+'</div></div>'+btn('+ Add','cart-add:'+p.id,'primary sm')+'</div>';}
  function resourceCard(r){var s=A.sessionFor(r.id),src=M.resource(r,s),active=!!s,status=active?'In Use':'Available',cls=active?'active':'available';var detail=active?(s.billingMode==='per_game'?(A.num(s.gamesPurchased)+' games'):(s.endAt?A.timer(s.endAt-A.now()):'Open')):r.resourceType;return '<div class="resourceCard '+cls+'" data-action="resource:'+e(r.id)+'"><img src="'+e(src)+'" alt="'+e(r.name)+'"><div class="shade"></div><span class="resourceStatus badge '+(active?'bad':'good')+'">'+status+'</span><div class="resourceMeta"><strong>'+e(r.name)+'</strong><small>'+e(detail)+'</small></div></div>';}
  function nav(active){var items=[[12,'⌂','Home'],[15,'▦','Floor'],[20,'▣','POS'],[24,'◎','Players'],[40,'•••','More']];return '<nav class="bottomNav">'+items.map(function(x){return '<button data-action="go:'+x[0]+'" class="'+(active===x[0]?'active':'')+'"><b>'+x[1]+'</b>'+x[2]+'</button>';}).join('')+'</nav>';}
  function shell(no,body,opts){opts=opts||{};var cls='screen '+(opts.public?'public ':'')+(opts.wide?'wide ':'');var inner='screenInner '+(opts.narrow?'narrow':'');return '<main class="'+cls+'" data-screen="'+no+'"><div class="'+inner+'">'+body+(opts.claim?'<div class="footerClaim">LA PAUSE OS · A MORE CONNECTED GAMING WORLD</div>':'')+'</div>'+(!opts.public?nav(opts.nav||no):'')+'</main>';}
  function register(no,title,fn){REG[no]={no:no,title:title,render:fn};}
  function render(no){var x=REG[no]||REG[12];return x.render();}
  window.CanonicalUI={A:A,M:M,S:S,e:e,logo:logo,top:top,btn:btn,badge:badge,panel:panel,kpi:kpi,tabs:tabs,row:row,media:media,productCard:productCard,resourceCard:resourceCard,nav:nav,shell:shell,register:register,render:render,registry:REG};
})();
