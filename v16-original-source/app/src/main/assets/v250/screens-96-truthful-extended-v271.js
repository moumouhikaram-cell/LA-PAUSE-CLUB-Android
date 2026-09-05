'use strict';
(function(){
  var A=window.LPOS,S=A&&A.state,U=window.LPOSScreens;if(!A||!S||!U)return;
  var m=U.metric,r=U.row,c=U.card,sec=U.section,b=U.btn;
  function dayKey(ts){try{return new Date(ts||0).toLocaleDateString('sv-SE',{timeZone:(S.business&&S.business.timezone)||'Africa/Casablanca'});}catch(_){return new Date(ts||0).toISOString().slice(0,10);}}
  function isToday(x){return dayKey(x&&x.at||x&&x.createdAt)===dayKey(Date.now());}

  U.register(45,function(){
    var gross=A.grossRevenueToday?A.grossRevenueToday():A.revenueToday(),refunds=A.refundsToday?A.refundsToday():0;
    var expenses=(S.expenses||[]).filter(isToday).reduce(function(sum,x){return sum+A.num(x.amount,0);},0),net=A.revenueToday()-expenses;
    var postedCash=(S.payments||[]).filter(function(p){var st=String(p.status||'').toUpperCase();return (st==='PAID'||st==='REFUNDED')&&String(p.method||'cash').toLowerCase()==='cash'&&isToday(p);});
    var byId={};(S.payments||[]).forEach(function(p){byId[p.id]=p;});
    var cashGross=postedCash.reduce(function(sum,p){return sum+A.num(p.amount,0);},0);
    var cashRefunds=(S.refunds||[]).filter(function(x){var p=byId[x.paymentId];return isToday(x)&&p&&String(p.method||'cash').toLowerCase()==='cash';}).reduce(function(sum,x){return sum+A.num(x.amount,0);},0);
    var shift=(S.shifts||[]).find(function(x){return String(x.status||'').toUpperCase()==='OPEN';}),expected=cashGross-cashRefunds+(shift?A.num(shift.openingFloat,0):0),counted=shift&&shift.countedCash!=null?A.num(shift.countedCash):null;
    return '<div class="grid4">'+m('Gross Sales',A.money(gross),'posted payments')+m('Refunds',A.money(refunds),'refund ledger')+m('Expenses',A.money(expenses),'today')+m('Net after expenses',A.money(net),'gross - refunds - expenses')+'</div>'+sec('Reconciliation')+c('Closing & Finance','<div class="list">'+
      r('Expected Cash','Cash sales - cash refunds + opening float',A.money(expected))+
      r('Counted Cash','Operator count',counted==null?'PENDING':A.money(counted),counted==null?'warn':'')+
      r('Variance','Counted - expected',counted==null?'PENDING':A.money(counted-expected),counted==null?'warn':'')+
      r('Credit Notes','Accounting correction workflow','NOT CONFIGURED','warn')+'</div>');
  });

  U.register(49,function(){
    var eligible=(S.payments||[]).filter(function(x){return String(x.status||'').toUpperCase()==='PAID';}).length;
    return c('Refunds / Credit Notes / Corrections','<div class="list">'+
      r('Full Refund','Existing implemented flow',eligible?eligible+' eligible payment(s)':'NO ELIGIBLE PAYMENT',eligible?'':'warn')+
      r('Partial Refund','Amount-level correction','NOT CONFIGURED','warn')+
      r('Credit Note','Accounting correction','NOT CONFIGURED','warn')+
      r('Exchange','Product correction','NOT CONFIGURED','warn')+
      r('Same-payment full refund','PAID → REFUNDED transition','GUARDED')+
      '</div><div class="actions mt">'+b('Create Full Refund','create-refund','danger')+b('Back to Cash','go:21','ghost')+'</div>');
  });

  U.register(52,function(){
    var bundles=S.supportBundles||[];
    return '<div class="grid2"><div>'+c('Support Diagnostics','<div class="list">'+
      r('Support Records','Local redacted records',String(bundles.length))+
      r('Versions / Health','Diagnostic metadata contract','AVAILABLE')+
      r('Secrets / PIN hashes / tokens','Never requested by this local record','EXCLUDED')+
      r('Exportable diagnostic archive','File generation','NOT CONFIGURED','warn')+
      '</div>'+b('Create Redacted Support Record','support-bundle','primary mt'))+'</div><div>'+c('Privacy Boundary','<div class="list">'+
      r('Secrets','Must never be exported','FORBIDDEN','bad')+
      r('PIN hashes','Must never be exported','FORBIDDEN','bad')+
      r('Tokens','Must never be exported','FORBIDDEN','bad')+
      r('Unnecessary PII','Must never be exported','FORBIDDEN','bad')+'</div>')+'</div></div>';
  });

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

  U.register(55,function(){
    var metrics=S.operatorMetrics||{},experiments=S.experiments||[],forecasts=S.forecasts||[],nba=A.nextBestAction?A.nextBestAction():{kind:'none'};
    return '<div class="grid4">'+m('Assisted Revenue',A.money(metrics.assistedRevenue||0),'attributed')+m('Accepted Actions',String(metrics.acceptedActions||0),'tracked')+m('Experiments',String(experiments.length),'actual')+m('Lost Revenue',A.money(metrics.lostRevenue||0),'tracked')+'</div>'+sec('Revenue Engine')+'<div class="list">'+
      r('Revenue Moments','Next Best Action',nba.kind&&nba.kind!=='none'?'LIVE RECOMMENDATION':'NO CURRENT ACTION',nba.kind&&nba.kind!=='none'?'':'warn')+
      r('Profit Autopilot','Margin-aware autonomous changes','NOT CONFIGURED','warn')+
      r('Smart Seat','Queue → free resource','MANUAL WORKFLOW')+
      r('Dynamic Loyalty','Player-value automation','NOT CONFIGURED','warn')+
      r('Inventory Brain','Demand model','NO MODEL','warn')+
      r('Hardware ROI','Resource return model','NO DATA','warn')+
      r('Forecast','Scenario model',forecasts.length?forecasts.length+' model(s)':'NO DATA',forecasts.length?'':'warn')+
      r('Monthly Value Report','Owner SaaS value report','NOT CONFIGURED','warn')+'</div>';
  });

  U.register(56,function(){
    var tasks=S.staffTasks||S.tasks||[],approvals=S.approvals||[],staff=S.staff||[],inc=S.incidents||[],bookings=S.bookings||[],devices=S.devices||[],nba=A.nextBestAction?A.nextBestAction():{title:'No urgent action'};
    return '<div class="grid2"><div>'+c('Staff Planner','<div class="list">'+
      r('Staff','Actual team records',String(staff.length))+
      r('Scheduled Coverage','Demand vs staff','NOT CONFIGURED','warn')+
      r('Tasks','Assigned shift actions',tasks.length?tasks.length+' task(s)':'EMPTY',tasks.length?'':'warn')+
      r('Approvals','Sensitive actions',approvals.length?approvals.length+' pending/recorded':'EMPTY',approvals.length?'':'warn')+
      '</div>')+'</div><div>'+c('Daily Brief','<div class="list">'+
      r('Revenue','Net today',A.money(A.revenueToday()))+
      r('Incidents','Actual records',String(inc.length))+
      r('Bookings','Upcoming / recorded',String(bookings.length))+
      r('Devices','Paired records',String(devices.length))+
      r('Next Best Action','Current recommendation',nba.title||'No urgent action')+'</div>')+'</div></div>';
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