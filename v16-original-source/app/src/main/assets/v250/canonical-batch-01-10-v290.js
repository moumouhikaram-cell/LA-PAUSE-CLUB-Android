'use strict';
(function(){
  var A=window.LPOS,U=window.LPOSScreens,S=A&&A.state;
  if(!A||!U||!S)return;
  var M='../media/',P=M+'premium/';
  function e(v){return U.esc(v==null?'':v);}
  function n(v,d){var x=Number(v);return isFinite(x)?x:(d||0);}
  function money(v){return A.money?A.money(n(v)):n(v).toFixed(0)+' MAD';}
  function persist(evt,payload){A.persist(evt||null,payload||null);}
  function go(no){S.ui.navStack=Array.isArray(S.ui.navStack)?S.ui.navStack:[];S.ui.scroll=0;A.setScreen(no);location.reload();}
  function stateBadge(status){var x=String(status||'PENDING').toUpperCase(),c=(x==='ONLINE'||x==='ACTIVE'||x==='AVAILABLE')?'green':(x==='ERROR'||x==='OFFLINE'||x==='BLOCKED')?'red':'amber';return '<span class="b010-pill '+c+'">'+e(x)+'</span>';}
  function logo(extra){return '<div class="b010-brand '+(extra||'')+'"><div class="b010-brand-left"><div class="brand-mark"></div><div class="b010-logo-text">LA PAUSE <b>OS</b></div></div><button class="b010-lang" data-action="language">◉ '+e((S.ui.language||'en').toUpperCase())+'⌄</button></div>';}
  function foot(){return '<div class="b010-mini-foot"><span>LA PAUSE OS</span><i></i><span>PLAY · MANAGE · GROW</span></div>';}
  function shell(no,body,cls){return '<div class="canon-screen b010-screen b010-'+String(no).padStart(2,'0')+' '+(cls||'')+'">'+body+'</div>';}
  function title(k,h,p){return (k?'<div class="b010-kicker">'+e(k)+'</div>':'')+'<h1 class="b010-title">'+h+'</h1>'+(p?'<p class="b010-sub">'+p+'</p>':'');}
  function input(id,label,placeholder,type,value){return '<label class="b010-field"><span>'+e(label)+'</span><div class="b010-input-wrap"><input id="'+e(id)+'" class="b010-input" type="'+e(type||'text')+'" placeholder="'+e(placeholder||'')+'" value="'+e(value||'')+'"></div></label>';}
  function select(id,label,options,value){return '<label class="b010-field"><span>'+e(label)+'</span><select id="'+e(id)+'" class="b010-input">'+options.map(function(x){var val=Array.isArray(x)?x[0]:x,lab=Array.isArray(x)?x[1]:x;return '<option value="'+e(val)+'" '+(String(val)===String(value)?'selected':'')+'>'+e(lab)+'</option>';}).join('')+'</select></label>';}
  function button(text,attrs,cls){return '<button class="b010-btn '+(cls||'')+'" '+(attrs||'')+'>'+text+'</button>';}
  function iconBox(icon,titleTxt,sub){return '<div class="b010-feature"><span>'+icon+'</span><div><b>'+e(titleTxt)+'</b><small>'+e(sub||'')+'</small></div></div>';}
  function row(icon,name,sub,side,attrs,selected,img){return '<div class="b010-row '+(selected?'selected':'')+'" '+(attrs||'')+'>'+(img?'<div class="b010-thumb" style="background-image:url(\''+e(img)+'\')"></div>':'<div class="b010-row-icon">'+icon+'</div>')+'<div class="b010-grow"><b>'+e(name)+'</b><small>'+e(sub||'')+'</small></div>'+(side||'')+'</div>';}
  function card(body,cls){return '<div class="b010-card '+(cls||'')+'">'+body+'</div>';}
  function actualWorkspaceCount(){return Array.isArray(S.workspaces)?S.workspaces.length:0;}
  function ensureScope(){S.scope=S.scope||{};}
  function onboardingFacts(){
    var org=!!(S.tenants&&S.tenants.length&&S.workspaces&&S.workspaces.length);
    var venue=!!(S.venues&&S.venues.length&&S.branches&&S.branches.length);
    var pricing=!!(S.meta&&S.meta.pricingConfiguredV290);
    var floor=!!(A.resources&&A.resources().length);
    var team=!!(S.staff&&S.staff.length);
    var ready=!!(S.onboarding&&n(S.onboarding.readiness)>=100&&(!S.onboarding.blockers||!S.onboarding.blockers.length));
    return [org,venue,pricing,floor,team,ready];
  }
  function nextIncomplete(){var f=onboardingFacts();for(var i=0;i<f.length;i++)if(!f[i])return i+1;return 6;}

  U.register(1,function(){
    return shell(1,
      '<header class="b010-sales-head"><div class="b010-brand-left"><div class="brand-mark"></div><div class="b010-logo-text">LA PAUSE <b>OS</b></div></div><nav><button data-go="37">Product</button><button data-go="15">Solutions⌄</button><button data-go="37">Pricing</button><button data-go="10">Resources⌄</button></nav>'+button('Get Started','data-go="3"','primary tiny')+'</header>'+
      '<div class="b010-sales-hero"><div class="b010-sales-copy">'+title('THE ALL-IN-ONE GAMING VENUE OS','More Play.<br>More <span class="grad">Revenue.</span>','LA PAUSE OS is a multi-tenant SaaS operating system built for modern gaming venues. Manage, automate, and grow — from a single platform.')+'<div class="b010-actions">'+button('Start Free Trial&nbsp; →','data-go="3"','primary')+button('▶ &nbsp; Watch Demo','data-v290="demo"','outline')+'</div></div><div class="b010-sales-image" style="background-image:url(\''+M+'esport-dynamic.png\')"><div>GOOD<br>GAMES<br>BRIGHTER<br>PEOPLE</div></div></div>'+
      '<div class="b010-feature-grid">'+iconBox('✦','Multi-Tenant SaaS','')+iconBox('◫','Revenue Optimization','')+iconBox('☁','Edge + Cloud Architecture','')+iconBox('▣','Device Control & Automation','')+iconBox('♞','Player Engagement & Loyalty','')+iconBox('▤','Trusted Offline Operation','')+'</div>'+
      card('<div class="b010-earth"></div><div class="b010-worldline">POWERING GAMING<br>VENUES WORLDWIDE</div><div class="b010-stat-grid"><div><b>50+</b><span>Countries</span></div><div><b>5,000+</b><span>Venues</span></div><div><b>10M+</b><span>Players</span></div><div><b>99.9%</b><span>Uptime</span></div></div><div class="b010-quote">“LA PAUSE OS gives us complete control across all our venues. It saves us hours every day and helps us grow faster.”<small>— Operator testimonial</small></div>','world')+foot(),'sales');
  });

  U.register(2,function(){
    return shell(2,logo()+
      '<div class="b010-auth-center">'+title('','Welcome back','Sign in to your workspace and keep<br>your venues running.')+
      input('email','Email address','you@company.com','email',S.identity&&S.identity.email||'')+
      '<label class="b010-field"><span>Password</span><div class="b010-input-wrap"><input id="password" class="b010-input" type="password" placeholder="••••••••••"><button class="b010-eye" type="button" data-v290="toggle-password">◉</button></div></label>'+
      '<div class="b010-between"><label><input type="checkbox" checked> Remember this device</label><button class="b010-link" data-v290="forgot-password">Forgot password?</button></div>'+
      button('Sign In &nbsp; →','data-action="signin"','primary block')+
      '<div class="b010-divider"><span>or continue with</span></div>'+button('<b class="g">G</b> Continue with Google','data-v290="sso:Google"','outline block')+button('<b>▦</b> Continue with Microsoft','data-v290="sso:Microsoft"','outline block')+button('<b>●</b> Continue with Apple','data-v290="sso:Apple"','outline block')+
      card('<div class="b010-tenant-icon">▥</div><div><b>Tenant-aware login</b><small>Access your organization’s secure workspace, data and venues.</small></div>','tenant-info')+
      '</div>','auth');
  });

  U.register(3,function(){
    return shell(3,logo()+
      '<div class="b010-auth-center">'+title('JOIN A GLOBAL COMMUNITY','Create your account','Start managing your gaming venues<br>in minutes.')+
      input('newName','Full name','John Doe','text',S.identity&&S.identity.displayName||'')+
      input('newEmail','Work email','you@company.com','email',S.identity&&S.identity.email||'')+
      '<label class="b010-field"><span>Password</span><div class="b010-input-wrap"><input id="newPassword" class="b010-input" type="password" placeholder="••••••••••"><button class="b010-eye" type="button" data-v290="toggle-new-password">◉</button></div></label>'+
      '<div class="b010-pass-rules"><span>● &nbsp; At least 8 characters</span><span>● &nbsp; One number</span><span>● &nbsp; One letter</span></div>'+button('Create account &nbsp; →','data-action="create-account"','primary block')+
      '<div class="b010-signin-line">Already have an account? <button class="b010-link" data-go="2">Sign in</button></div>'+
      '<div class="b010-proof3"><div><b>ϟ</b><span>Fast setup</span><small>Get started in minutes</small></div><div><b>♟</b><span>Built for operators</span><small>From single venue to global brands</small></div><div><b>◆</b><span>Enterprise ready</span><small>Secure, scalable, reliable</small></div></div>'+
      '</div>','auth');
  });

  U.register(4,function(){
    var country=(S.business&&S.business.country)||'MA',bt=(S.business&&S.business.businessType)||'';
    return shell(4,logo()+
      '<div class="b010-auth-center wide">'+title('SET UP YOUR ORGANIZATION','Create your organization','Tell us about your business. You can add<br>more details later.')+
      input('orgName','Company name','e.g. Next Level Gaming Ltd.','text',(S.business&&S.business.name)||'')+
      select('orgCountry','Country',[['MA','Morocco'],['FR','France'],['ES','Spain'],['GB','United Kingdom'],['US','United States']],country)+
      select('orgBusinessType','Business type',[['','Select business type'],['GAMING_CAFE','Gaming Café'],['ESPORTS_ARENA','Esports Arena'],['VR_EXPERIENCE','VR Experience'],['FAMILY_ENTERTAINMENT','Family Entertainment'],['HYBRID_VENUE','Hybrid Venue']],bt)+
      input('orgBrand','Brand name (for player-facing display)','e.g. Next Level Gaming','text',(S.business&&S.business.brand)||'')+
      select('orgLanguage','Preferred language',[['en','English (International)'],['fr','Français'],['ar','العربية']],S.ui.language||'en')+
      card('<div class="b010-plan-head"><span>♛</span><div><b>Pro Plan</b><small>Everything you need to run and grow.</small></div><em>RECOMMENDED</em></div><ul><li>Multi-venue management</li><li>Device control & automation</li><li>Player engagement & loyalty</li><li>Advanced reporting & analytics</li></ul>','plan')+
      button('Create organization &nbsp; →','data-v290="create-org"','primary block')+'<div class="b010-note">You can change these settings later.</div></div>','auth');
  });

  U.register(5,function(){
    var ws=Array.isArray(S.workspaces)?S.workspaces:[],name=(S.identity&&S.identity.displayName)||'Account';
    return shell(5,
      '<div class="b010-work-head"><div class="b010-brand-left"><div class="brand-mark"></div><div class="b010-logo-text">LA PAUSE <b>OS</b></div></div><div class="b010-user"><span>♟</span><div class="b010-avatar">'+e(name.slice(0,2).toUpperCase())+'</div><div><b>'+e(name)+'</b><small>Super Admin</small></div></div></div>'+
      title('','Switch workspace','Select an organization to continue')+
      '<div class="b010-search">⌕<input id="workspaceSearch" placeholder="Search organizations..."></div>'+
      '<div class="b010-list workspaces">'+(ws.length?ws.map(function(w,i){var count=(S.venues||[]).filter(function(v){return !v.workspaceId||v.workspaceId===w.id;}).length;return row('M',w.name,(count||0)+' venues',stateBadge(i===0?'ACTIVE':'AVAILABLE')+' <b class="b010-arrow">→</b>','data-action="select-workspace:'+e(w.id)+'"',i===0);}).join(''):card('<b>No workspace yet</b><small>Create your organization to continue.</small>','empty'))+row('+','Create a new organization','Add another brand or venue group','<b class="b010-arrow">→</b>','data-go="4"')+'</div>'+card('<div class="b010-globe">◎</div><div><b>One account. Multiple brands.</b><small>Manage all your venues from a single login, across countries, under your control.</small></div>','one-account')+foot(),'selector');
  });

  U.register(6,function(){
    var opts=[['GAMING_CAFE','Gaming Café','PC & console gaming, drop-in play, food & drinks',M+'esport-dynamic.png'],['ESPORTS_ARENA','Esports Arena','Large scale, tournaments & events',M+'esport-team.jpg'],['VR_EXPERIENCE','VR Experience','Immersive VR attractions & free roam',P+'arcade.jpg'],['FAMILY_ENTERTAINMENT','Family Entertainment','Multi-activity venue for all ages',P+'lounge.jpg'],['HYBRID_VENUE','Hybrid Venue','Combine gaming, VR, sim racing & more',P+'pc.jpg']];
    return shell(6,logo()+title('CHOOSE YOUR VENUE TYPE','What kind of venue<br>are you setting up?','Pre-configured templates get you live faster.<br>You can customize everything later.')+'<div class="b010-list venue-types">'+opts.map(function(x,i){return row('',x[1],x[2],'<b class="b010-arrow">→</b>','data-v290="venue-type:'+x[0]+'"',i===0,x[3]);}).join('')+'</div>'+card('<div class="b010-compass">◈</div><div class="b010-grow"><b>Not sure yet?</b><small>Take our 2-minute quiz and we’ll recommend the best setup.</small></div><b class="b010-arrow">→</b>','quiz')+foot(),'selector');
  });

  U.register(7,function(){
    var bs=Array.isArray(S.branches)?S.branches:[];
    return shell(7,logo()+title('ADD YOUR FIRST BRANCH','Which branch are<br>you setting up?','A single account can manage multiple venues<br>and locations. Add your first branch to continue.')+'<div class="b010-search">⌕<input id="branchSearch" placeholder="Search country, city or venue name..."></div><div class="b010-list branches">'+(bs.length?bs.map(function(b,i){var city=b.city||b.country||((S.venues&&S.venues[0]&&S.venues[0].city)||'Location');var img=[M+'esport-dynamic.png',P+'pc.jpg',P+'lounge.jpg',M+'esport-team.jpg'][i%4];return row('',b.name,city,stateBadge(i===0?'PRIMARY':(b.status||'AVAILABLE'))+' <b class="b010-arrow">→</b>','data-action="select-branch:'+e(b.id)+'"',i===0,img);}).join(''):'')+row('+','Add another branch','Expand your brand. Manage all locations from one account.','<b class="b010-arrow">→</b>','data-v290="add-branch"')+'</div><div class="b010-proof3 branch-proof"><div><b>▥</b><span>Multi-branch ready</span></div><div><b>◎</b><span>Global expansion</span></div><div><b>♟</b><span>Consistent brand experience</span></div></div>'+foot(),'selector');
  });

  U.register(8,function(){
    var facts=onboardingFacts(),steps=[['♟','Account & Organization','Your company, owners and settings'],['▥','Select Venue & Branch','Choose type and location'],['▤','Business Model & Pricing','Configure how you operate'],['▦','Resources & Floor Layout','Add devices, zones and seats'],['♟','Team & Access','Invite staff and set permissions'],['▣','Review & Go Live','Final checks and launch!']];var active=nextIncomplete(),done=facts.filter(Boolean).length,pct=Math.round(done/6*100);
    return shell(8,logo()+title('GET YOUR VENUE LIVE','From setup to<br>ready for players','Follow our guided onboarding. Most venues<br>go live in under 30 minutes.')+'<div class="b010-step-list">'+steps.map(function(x,i){var no=i+1,isDone=facts[i],isActive=no===active;return '<div class="b010-step '+(isDone?'done ':'')+(isActive?'active':'')+'"><div class="b010-step-no">'+no+'</div><div class="b010-step-ico">'+x[0]+'</div><div class="b010-grow"><b>'+x[1]+'</b><small>'+x[2]+'</small></div><div class="b010-step-status">'+(isDone?'✓':'○')+'</div></div>';}).join('')+'</div><div class="b010-progress-head"><b>Your progress</b><span>'+done+' of 6 completed</span><strong>'+pct+'%</strong></div><div class="b010-progress"><i style="width:'+pct+'%"></i></div>'+button((active===6?'Review & Go Live':'Continue Setup')+' &nbsp; →','data-v290="onboarding-next"','primary block setup-cta')+'<div class="b010-proof3 onboard-proof"><div><b>ϟ</b><span>Fast setup</span><small>Save hours</small></div><div><b>✓</b><span>Best practices</span><small>Built-in</small></div><div><b>➤</b><span>Get live quickly</span><small>Start earning</small></div></div>'+foot(),'selector onboarding');
  });

  U.register(9,function(){
    var r=S.rates||{};
    return shell(9,logo()+title('CONFIGURE YOUR BUSINESS MODEL','How do you want<br>to generate revenue?','Choose your model and set your pricing.<br>You can enable multiple revenue streams.')+'<div class="b010-model-grid"><button class="selected" data-v290="model:TIME"><b>◷</b><strong>Time Based</strong><small>Hourly or per minute<br>PC, console, or VR</small><i>●</i></button><button data-v290="model:MEMBERSHIP"><b>♛</b><strong>Membership</strong><small>Recurring plans<br>and loyalty perks</small><i>○</i></button><button data-v290="model:EVENT"><b>▣</b><strong>Event Based</strong><small>Tournaments,<br>events & bookings</small><i>○</i></button></div><div class="b010-section-label">Set your base pricing (MAD)</div><div class="b010-price-list">'+
      '<label><span class="ico">▣</span><b>PC Gaming</b><div><span>MAD</span><input id="ratePc" type="number" min="0" value="'+e(r.pc||r.pcGaming||0)+'"><em>/ hour</em></div></label>'+
      '<label><span class="ico">🎮</span><b>Console (PS5 / Xbox)</b><div><span>MAD</span><input id="rateConsole" type="number" min="0" value="'+e(r.ps5Solo||0)+'"><em>/ hour</em></div></label>'+
      '<label><span class="ico">◉</span><b>VR Experience</b><div><span>MAD</span><input id="rateVr" type="number" min="0" value="'+e(r.vr||0)+'"><em>/ hour</em></div></label></div>'+button('＋ &nbsp; Add another service','data-v290="extra-pricing"','outline dashed block')+
      '<div class="b010-toggle-list"><label><span>♛</span><div><b>Enable memberships</b><small>Daily, weekly, monthly plans</small></div><input id="toggleMemberships" type="checkbox" '+((S.features&&S.features.memberships!==false)?'checked':'')+'><i></i></label><label><span>◇</span><div><b>Enable packages</b><small>Bundles (e.g. 5 hours, 10 hours)</small></div><input id="togglePackages" type="checkbox" '+((S.features&&S.features.packages!==false)?'checked':'')+'><i></i></label><label><span>▣</span><div><b>Enable events & bookings</b><small>Private events, tournaments</small></div><input id="toggleEvents" type="checkbox" '+((S.features&&S.features.events!==false)?'checked':'')+'><i></i></label></div>'+button('Save & Continue &nbsp; →','data-v290="save-pricing"','primary block')+foot(),'selector pricing');
  });

  U.register(10,function(){
    var rs=A.resources?A.resources():[],zones=Array.isArray(S.zones)?S.zones:[],cap=rs.reduce(function(a,r){return a+n(r.capacity,1);},0);
    var zoneHtml=zones.length?zones.slice(0,4).map(function(z,i){var count=rs.filter(function(r){return r.zone===z.name||r.zoneId===z.id;}).length,cl=['cyan','green','violet','cyan'][i%4];return '<div class="b010-zone '+cl+' z'+i+'"><b>'+e(z.name)+'</b><span>'+count+' seats</span><div class="b010-device-dots">'+new Array(Math.min(8,count)+1).join('<i></i>')+'</div></div>';}).join(''):'<div class="b010-floor-empty"><b>No zones yet</b><small>Add a zone to start building the real floor.</small></div>';
    return shell(10,logo()+title('DESIGN YOUR VENUE','Set up your resources<br>and build your floor','Add devices, zones and build your floor layout.<br>A visual setup helps you go live faster and<br>keeps operations organized.')+'<div class="b010-tabs"><button class="active" data-v290="floor-tab:builder">Floor Builder</button><button data-v290="floor-tab:devices">Device List</button><button data-v290="floor-tab:zones">Zones</button></div><div class="b010-floor-actions">'+button('▣ &nbsp; Add Zone','data-v290="add-zone"','outline')+button('♙ &nbsp; Add Device','data-v290="add-device"','outline')+button('✎ &nbsp; Draw Wall','data-v290="draw-wall"','outline')+'</div><div class="b010-floor"><div class="b010-gridlines"></div>'+zoneHtml+'<div class="b010-floor-controls"><button>＋</button><button>−</button><button>⌗</button></div><div class="b010-reception">Reception</div><div class="b010-entrance">Entrance</div></div><div class="b010-floor-metrics"><div><b>▣</b><strong>'+rs.length+'</strong><span>Devices</span></div><div><b>▦</b><strong>'+zones.length+'</strong><span>Zones</span></div><div><b>♟</b><strong>'+cap+'</strong><span>Total Capacity</span></div></div>'+button('Save Layout & Continue &nbsp; →','data-v290="save-layout"','primary block')+foot(),'floor');
  });

  function modal(title,body){var root=document.getElementById('modalRoot');if(!root)return;root.innerHTML='<div class="modal-backdrop"><section class="modal-sheet"><div class="modal-head"><b>'+e(title)+'</b><button class="icon-btn" data-v290="close-modal">×</button></div><div class="modal-body">'+body+'</div></section></div>';}
  function closeModal(){var r=document.getElementById('modalRoot');if(r)r.innerHTML='';}
  function createOrg(){
    ensureScope();var name=(document.getElementById('orgName')||{}).value||'',country=(document.getElementById('orgCountry')||{}).value||'MA',bt=(document.getElementById('orgBusinessType')||{}).value||'',brand=(document.getElementById('orgBrand')||{}).value||name,lang=(document.getElementById('orgLanguage')||{}).value||'en';
    name=name.trim();if(!name){var el=document.getElementById('orgName');if(el)el.focus();return;}
    S.business=S.business||{};S.business.name=name;S.business.brand=brand.trim()||name;S.business.country=country;S.business.businessType=bt;S.ui.language=lang;S.ui.rtl=lang==='ar';S.tenants=S.tenants||[];S.workspaces=S.workspaces||[];
    var tenant=S.tenants[0]||{id:A.uid('tenant'),name:name,status:'PENDING_SETUP',plan:null};tenant.name=name;if(!S.tenants.length)S.tenants.push(tenant);
    var ws=S.workspaces[0]||{id:A.uid('workspace'),tenantId:tenant.id,name:name,brand:S.business.brand};ws.name=name;ws.brand=S.business.brand;if(!S.workspaces.length)S.workspaces.push(ws);
    S.scope.tenantId=tenant.id;S.scope.workspaceId=ws.id;persist('ORGANIZATION_CREATED',{tenantId:tenant.id,workspaceId:ws.id});go(5);
  }
  function chooseVenue(type){
    ensureScope();S.business=S.business||{};S.business.businessType=type;S.venues=S.venues||[];
    if(!S.venues.length){var v={id:A.uid('venue'),tenantId:S.scope.tenantId||null,workspaceId:S.scope.workspaceId||null,name:(S.business.brand||S.business.name||'Gaming Venue'),city:'',country:S.business.country||'MA',status:'PENDING_SETUP',businessType:type};S.venues.push(v);S.scope.venueId=v.id;}else{S.venues[0].businessType=type;S.scope.venueId=S.scope.venueId||S.venues[0].id;}
    persist('VENUE_TYPE_SELECTED',{businessType:type,venueId:S.scope.venueId});go(7);
  }
  function saveBranch(){
    ensureScope();var name=(document.getElementById('v290BranchName')||{}).value||'',city=(document.getElementById('v290BranchCity')||{}).value||'';name=name.trim();if(!name)return;
    S.branches=S.branches||[];var b={id:A.uid('branch'),tenantId:S.scope.tenantId||null,venueId:S.scope.venueId||((S.venues&&S.venues[0])?S.venues[0].id:null),name:name,city:city.trim(),status:'PENDING_SETUP'};S.branches.push(b);S.scope.branchId=b.id;persist('BRANCH_CREATED',{branchId:b.id,name:name});closeModal();go(8);
  }
  function savePricing(){
    S.rates=S.rates||{};S.features=S.features||{};S.meta=S.meta||{};
    S.rates.pc=n((document.getElementById('ratePc')||{}).value,0);S.rates.ps5Solo=n((document.getElementById('rateConsole')||{}).value,S.rates.ps5Solo||0);S.rates.vr=n((document.getElementById('rateVr')||{}).value,0);
    S.features.memberships=!!((document.getElementById('toggleMemberships')||{}).checked);S.features.packages=!!((document.getElementById('togglePackages')||{}).checked);S.features.events=!!((document.getElementById('toggleEvents')||{}).checked);S.meta.pricingConfiguredV290=true;
    persist('PRICING_CONFIGURED',{pc:S.rates.pc,console:S.rates.ps5Solo,vr:S.rates.vr});go(10);
  }
  function saveExtraPricing(){
    S.rates=S.rates||{};var sim=n((document.getElementById('v290RateSim')||{}).value,S.rates.sim||0),bill=n((document.getElementById('v290RateBilliard')||{}).value,S.rates.billiardGame||0);S.rates.sim=sim;S.rates.billiardGame=bill;persist('EXTRA_PRICING_CONFIGURED',{sim:sim,billiardGame:bill});closeModal();location.reload();
  }
  function addZone(){modal('Add Zone','<label class="b010-field"><span>Zone name</span><input id="v290ZoneName" class="b010-input" placeholder="Console Zone"></label>'+button('Create Zone','data-v290="save-zone"','primary block'));}
  function saveZone(){var name=((document.getElementById('v290ZoneName')||{}).value||'').trim();if(!name)return;S.zones=S.zones||[];var z={id:A.uid('zone'),name:name};S.zones.push(z);persist('ZONE_CREATED',{zoneId:z.id,name:name});closeModal();location.reload();}
  function addDevice(){var types=A.RESOURCE_TYPES||['CONSOLE','SIM_RACING','PC_GAMING','BILLIARD_TABLE','SNOOKER_TABLE','PING_PONG','ROOM','CUSTOM'];var zoneOpts=(S.zones||[]).map(function(z){return '<option value="'+e(z.name)+'">'+e(z.name)+'</option>';}).join('');modal('Add Device / Resource','<label class="b010-field"><span>Name</span><input id="v290DeviceName" class="b010-input" placeholder="PS5 1"></label><label class="b010-field"><span>Resource type</span><select id="v290DeviceType" class="b010-input">'+types.map(function(t){return '<option>'+e(t)+'</option>';}).join('')+'</select></label><label class="b010-field"><span>Zone</span><select id="v290DeviceZone" class="b010-input"><option>Main</option>'+zoneOpts+'</select></label><label class="b010-field"><span>Capacity</span><input id="v290DeviceCapacity" class="b010-input" type="number" min="1" value="1"></label>'+button('Add Device','data-v290="save-device"','primary block'));}
  function saveDevice(){var name=((document.getElementById('v290DeviceName')||{}).value||'').trim(),type=(document.getElementById('v290DeviceType')||{}).value||'CUSTOM',zone=(document.getElementById('v290DeviceZone')||{}).value||'Main',capacity=Math.max(1,n((document.getElementById('v290DeviceCapacity')||{}).value,1));if(!name)return;S.resources=S.resources||[];var r=Object.assign(A.entityBase?A.entityBase(S.scope):{}, {id:A.uid('resource'),name:name,resourceType:type,enabled:true,status:'available',zone:zone,capacity:capacity,sort:S.resources.length+1});S.resources.push(r);persist('RESOURCE_CREATED',{resourceId:r.id,resourceType:type});closeModal();location.reload();}
  function onboardingNext(){var step=nextIncomplete();if(step===1){go(4);return;}if(step===2){go((S.venues&&S.venues.length)?7:6);return;}if(step===3){go(9);return;}if(step===4){go(10);return;}if(step===5){go(36);return;}go(44);}

  document.addEventListener('click',function(ev){
    var el=ev.target&&ev.target.closest?ev.target.closest('[data-v290]'):null;if(!el)return;var a=el.getAttribute('data-v290')||'';ev.preventDefault();ev.stopImmediatePropagation();
    if(a==='create-org'){createOrg();return;}if(a.indexOf('venue-type:')===0){chooseVenue(a.split(':')[1]);return;}if(a==='add-branch'){modal('Add another branch','<label class="b010-field"><span>Branch name</span><input id="v290BranchName" class="b010-input" placeholder="El Hajeb · Main"></label><label class="b010-field"><span>City</span><input id="v290BranchCity" class="b010-input" placeholder="El Hajeb"></label>'+button('Create branch & continue →','data-v290="save-branch"','primary block'));return;}if(a==='save-branch'){saveBranch();return;}if(a==='save-pricing'){savePricing();return;}if(a==='extra-pricing'){modal('Add another service','<label class="b010-field"><span>SIM Racing — MAD / hour</span><input id="v290RateSim" class="b010-input" type="number" min="0" value="'+e((S.rates&&S.rates.sim)||0)+'"></label><label class="b010-field"><span>Billiard / Snooker — MAD / game</span><input id="v290RateBilliard" class="b010-input" type="number" min="0" value="'+e((S.rates&&S.rates.billiardGame)||0)+'"></label>'+button('Save Services','data-v290="save-extra-pricing"','primary block'));return;}if(a==='save-extra-pricing'){saveExtraPricing();return;}if(a==='add-zone'){addZone();return;}if(a==='save-zone'){saveZone();return;}if(a==='add-device'){addDevice();return;}if(a==='save-device'){saveDevice();return;}if(a==='draw-wall'){modal('Draw Wall','<p class="canon-sub">Floor wall drawing is a visual editing mode. The canonical floor remains unchanged until a wall is explicitly placed and saved.</p>'+button('Close','data-v290="close-modal"','outline block'));return;}if(a==='save-layout'){S.meta=S.meta||{};S.meta.floorConfiguredV290=true;persist('FLOOR_LAYOUT_SAVED',{resources:(A.resources?A.resources():[]).length,zones:(S.zones||[]).length});go(8);return;}if(a==='onboarding-next'){onboardingNext();return;}if(a==='forgot-password'){modal('Password recovery','<p class="canon-sub">Password recovery requires the configured account channel. No password is changed without verification.</p>'+button('Close','data-v290="close-modal"','outline block'));return;}if(a.indexOf('sso:')===0){modal(a.split(':')[1]+' SSO','<p class="canon-sub">SSO is shown exactly as in the canonical sign-in template. This local Android build will not claim an external SSO success until a provider is configured.</p>'+button('Close','data-v290="close-modal"','outline block'));return;}if(a==='toggle-password'||a==='toggle-new-password'){var id=a==='toggle-password'?'password':'newPassword',inp=document.getElementById(id);if(inp)inp.type=inp.type==='password'?'text':'password';return;}if(a==='demo'){go(S.identity&&S.identity.signedIn?12:6);return;}if(a==='close-modal'){closeModal();return;}if(a.indexOf('model:')===0){var parent=el.parentElement;if(parent)Array.prototype.forEach.call(parent.children,function(x){x.classList.remove('selected');var i=x.querySelector('i');if(i)i.textContent='○';});el.classList.add('selected');var ii=el.querySelector('i');if(ii)ii.textContent='●';return;}if(a.indexOf('floor-tab:')===0){var par=el.parentElement;if(par)Array.prototype.forEach.call(par.children,function(x){x.classList.remove('active');});el.classList.add('active');return;}
  },true);
})();
