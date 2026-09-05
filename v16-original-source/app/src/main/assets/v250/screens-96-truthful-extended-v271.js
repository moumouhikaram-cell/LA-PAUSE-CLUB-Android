'use strict';
(function(){
  var A=window.LPOS,S=A&&A.state,U=window.LPOSScreens;if(!A||!S||!U)return;
  var m=U.metric,r=U.row,c=U.card,sec=U.section;

  U.register(53,function(){
    var creatives=S.mediaCreatives||[],plays=S.proofOfPlay||[],reds=S.sponsorRedemptions||[];
    var completed=plays.filter(function(x){return String(x.status||'').toUpperCase()==='COMPLETED'||x.completedAt;}).length;
    return '<div class="grid2"><div>'+c('Media / Campaign Engine','<div class="list">'+
      r('Creative Library','Versioned assets',creatives.length?creatives.length+' asset(s)':'EMPTY',creatives.length?'':'warn')+
      r('Playlists','Offline cache','NOT CONFIGURED','warn')+
      r('Fallback Content','No-dark-station policy','NOT CONFIGURED','warn')+
      r('Proof of Play','Start / complete / checksum',plays.length?plays.length+' record(s)':'NO DATA',plays.length?'':'warn')+
      r('Brand Safety','Approval before publish','Required')+'</div>')+'</div><div>'+c('Sponsor ROI','<div class="grid2">'+
      m('Plays',String(plays.length),'actual records')+
      m('Completion',plays.length?Math.round(completed/plays.length*100)+'%':'—','actual period')+
      m('QR / Coupon',String(reds.length),'redemptions')+
      m('Sponsor Exchange','OFF','future flag')+
      '</div><p class="muted">Marketplace remains disabled until multi-site, legal, payments and compliance are validated.</p>')+'</div></div>';
  });

  U.register(54,function(){
    var mods=(S.saas&&S.saas.modules)||{},entitled=!!mods.M15_AI_OPERATOR,rules=S.automationRules||[],audit=S.audit||[];
    return '<div class="grid2"><div>'+c('AI Operator','<div class="offer"><div class="offerIcon">✦</div><div><b>Recommendations from real venue data</b><small class="muted">Human approval for risky actions</small></div><button class="btn primary" data-action="go:14">Open NBA</button></div><div class="list mt">'+
      r('AI Operator entitlement','M15 AI Operator',entitled?'ENABLED':'NOT CONFIGURED',entitled?'':'warn')+
      r('Natural-language Forensics','Audit + operations',entitled&&audit.length?'DATA AVAILABLE':'NO DATA',entitled&&audit.length?'':'warn')+
      r('Automation Rules','Condition → approved action',rules.length?rules.length+' configured':'NOT CONFIGURED',rules.length?'':'warn')+
      r('Outcome Measurement','AcceptedActions / Revenue','Tracked from real actions')+
      r('Synthetic AI claims','Placeholder success states','FORBIDDEN','bad')+'</div>')+'</div><div>'+c('Automation Rules','<div class="list">'+
      r('Session ending soon','Offer +30 min',rules.length?'RULE SET PRESENT':'NOT CONFIGURED',rules.length?'':'warn')+
      r('Empty seat + queue','Seat next',rules.length?'RULE SET PRESENT':'NOT CONFIGURED',rules.length?'':'warn')+
      r('Low stock','Create reorder suggestion',rules.length?'RULE SET PRESENT':'NOT CONFIGURED',rules.length?'':'warn')+
      r('Churn risk','Draft campaign',rules.length?'RULE SET PRESENT':'NOT CONFIGURED',rules.length?'':'warn')+'</div>')+'</div></div>';
  });

  U.register(57,function(){
    var bs=S.backups||[],verified=bs.some(function(x){return String(x.status||'').toUpperCase()==='VERIFIED'&&x.verifiedByNative===true;}),pending=bs.some(function(x){return String(x.status||'').toUpperCase()==='PENDING';}),health=S.meta&&S.meta.healthMetrics||{};
    function value(key){return health[key]!=null?String(health[key]):'—';}
    return '<div class="grid4">'+
      m('Command Latency',value('commandLatencyMs'),health.commandLatencyMs!=null?'ms':'NO DATA')+
      m('POS Write Latency',value('posWriteLatencyMs'),health.posWriteLatencyMs!=null?'ms':'NO DATA')+
      m('Sync Backlog',String((S.outbox||[]).length),'actual pending events')+
      m('Backup Success',verified?'VERIFIED':pending?'PENDING':'NOT CONFIGURED','native proof required')+
      '</div>'+sec('Venue Health')+'<div class="policy">'+
      m('Realtime Availability',value('realtimeAvailabilityPct'),health.realtimeAvailabilityPct!=null?'observed':'NO DATA')+
      m('Device Reconnect',value('deviceReconnectMs'),health.deviceReconnectMs!=null?'ms':'NO DATA')+
      m('Error Rate',value('errorRatePct'),health.errorRatePct!=null?'observed':'NO DATA')+
      m('Restore Success',value('restoreSuccessPct'),health.restoreSuccessPct!=null?'observed':'NO DATA')+'</div>';
  });

  U.register(58,function(){
    var gifts=S.giftVouchers||[],refs=S.referrals||[],passes=S.passes||[],families=S.families||[],consents=S.consents||[],members=S.memberships||[];
    return '<div class="grid2"><div>'+c('Growth Loops','<div class="list">'+
      r('Gift Vouchers','Prepaid value',gifts.length?gifts.length+' record(s)':'NOT CONFIGURED',gifts.length?'':'warn')+
      r('Referral','Invite → reward',refs.length?refs.length+' record(s)':'NOT CONFIGURED',refs.length?'':'warn')+
      r('Venue Credit','Wallet','NOT CONFIGURED','warn')+
      r('Prepaid Passes','Minutes / visits',passes.length?passes.length+' record(s)':'NOT CONFIGURED',passes.length?'':'warn')+
      r('Rollover','Plan rule',members.length?'PLAN DEPENDENT':'NOT CONFIGURED',members.length?'':'warn')+'</div>')+'</div><div>'+c('Family / Responsible Play','<div class="list">'+
      r('Guardian','Linked family account',families.length?families.length+' family record(s)':'NOT CONFIGURED',families.length?'':'warn')+
      r('Age rules','Policy metadata','NOT CONFIGURED','warn')+
      r('Session Limits','Responsible play','NOT CONFIGURED','warn')+
      r('Consent','Privacy & communication',consents.length?consents.length+' record(s)':'NO RECORDS',consents.length?'':'warn')+'</div>')+'</div></div>';
  });

  U.register(59,function(){
    var audit=S.audit||[],sessions=S.sessions||[],orders=S.orders||[],payments=S.payments||[];
    return '<div class="grid2"><div>'+c('Operational History','<div class="list">'+
      (audit.length?audit.slice(-12).reverse().map(function(x){return r(x.type,new Date(x.at||x.createdAt).toLocaleString(),x.id);}).join(''):r('No audit activity','Sensitive actions will appear here','EMPTY','warn'))+
      '</div>')+'</div><div>'+c('Orders / Sessions / Journal','<div class="grid3">'+
      m('Sessions',String(sessions.length),'all states')+m('Orders',String(orders.length),'POS')+m('Payments',String(payments.length),'ledger')+
      '</div><p class="muted">Navigation history, audit and data history remain separate concepts.</p>')+'</div></div>';
  });

  U.register(60,function(){
    var rates=S.rates||{},dyn=S.dynamicPricingRules||S.pricingRules||[];
    function price(label,v,suffix){var n=A.num(v,0);return r(label,n>0?A.money(n)+suffix:'—',n>0?'CONFIGURED':'NOT CONFIGURED',n>0?'':'warn');}
    return '<div class="grid2"><div>'+c('Pricing Rules','<div class="list">'+
      price('Console Solo',rates.ps5Solo,'/h')+price('Console Duo',rates.ps5Duo,'/h')+price('SIM Racing',rates.sim,'/h')+price('Billiard / Snooker',rates.billiardGame,'/game')+
      '</div>')+'</div><div>'+c('Dynamic Rules','<div class="list">'+
      r('Configured Dynamic Rules','Time / member / demand',dyn.length?dyn.length+' rule(s)':'NOT CONFIGURED',dyn.length?'':'warn')+
      r('Happy Hour','Time window','OPTIONAL')+r('Member Pricing','Tier benefit','OPTIONAL')+r('Demand Pricing','Guardrailed','OPTIONAL')+
      r('HQ Min / Max','Franchise policy','NOT CONFIGURED','warn')+
      r('Snooker price persistence','Edit → save → reload → quote','QA required','warn')+'</div>')+'</div></div>';
  });
})();