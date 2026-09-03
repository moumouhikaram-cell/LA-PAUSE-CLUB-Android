'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const index=read('app/src/main/assets/index.html');
const core=read('app/src/main/assets/client-product-core.js');
const views=read('app/src/main/assets/client-product-views.js');
const policy=read('app/src/main/assets/client-product-session-policy.js');
const css=read('app/src/main/assets/client-product-v230.css');
const responsive=read('app/src/main/assets/client-product-responsive.css');
const activity=read('app/src/main/java/com/lapauseclub/manager/PremiumActivity.java');
const manifest=read('app/src/main/AndroidManifest.xml');
const gradle=read('app/build.gradle.kts');
const media=read('tools/prepare-client-media-v230.sh');
const app=read('app/src/main/assets/app.js');
const has=(t,n,m)=>assert(t.includes(n),m||`Missing ${n}`);const not=(t,n,m)=>assert(!t.includes(n),m||`Forbidden ${n}`);

// One customer shell and one dashboard only.
['client-product-core.js','client-product-media.js','client-product-views.js','client-product-setup.js','client-product-boot.js','client-product-session-policy.js'].forEach(f=>has(index,`src="${f}"`,`missing runtime ${f}`));
['client-product-v230.js','client-shell.js','client-platform-guard.js','client-hardening.js','client-persistent-dock.js','client-final.js','venue-experience.js','p1-floor.js','master-v2-welcome.js'].forEach(f=>not(index,`src="${f}"`,`obsolete renderer loaded: ${f}`));
assert((views.match(/LP\.views\.csHome=/g)||[]).length===1,'must have exactly one customer dashboard');
has(views,'CONTROL CENTER');has(views,'cs-control-grid');has(views,'À FAIRE MAINTENANT');has(views,'ACTIVITÉ RÉCENTE');has(views,'PROCHAINES RÉSERVATIONS');

// Navigation: visible arrow + persistent route stack + scroll/form restoration + Android gesture/button parity.
['id="csBack"','clientNavStack','clientScroll','LP.captureDraft','LP.restoreDraft','LP.lastRendered','LP.pushHistory(prev)','LP.back=allowExit','window.nativeBack','window.clientSwipeBack'].forEach(x=>has(core,x,`navigation requirement missing: ${x}`));
has(activity,'registerOnBackInvokedCallback');has(activity,'this::handleBackRequest');has(activity,'window.nativeBack ? window.nativeBack() : false');has(activity,'Quitter LA PAUSE OS ?');has(manifest,'configChanges="orientation|screenSize|smallestScreenSize|keyboardHidden|uiMode"');

// Cash is never a global blocker. The effective policy auto-opens an operational cash shift only when cash is captured.
not(policy,'Ouvre d’abord un shift de caisse');has(policy,'SHIFT.AUTO_OPEN');has(policy,'ensureOperationalShift');has(policy,"String(method||'').toLowerCase()!=='cash'");has(policy,"window.startDraftSession=function()");
const safety=index.indexOf('master-v2-safety.js'),pidx=index.indexOf('client-product-session-policy.js'),cidx=index.indexOf('client-product-core.js');assert(safety<pidx&&pidx<cidx,'session policy load order invalid');

// Responsive SaaS cockpit.
['.cs-back','.cs-control-grid','.cs-command-card','.cs-mini-grid','.cs-command-shortcuts'].forEach(x=>has(css,x));has(css,'orientation:portrait');has(responsive,'orientation:landscape');has(responsive,'.cs-rail');has(responsive,'.cs-dock{display:none}');

// Contextual HD offline media.
const files=['ps5.jpg','sim.jpg','pc.jpg','billiard.jpg','snooker.jpg','table-tennis.jpg','arcade.jpg','lounge.jpg'];files.forEach(f=>{has(media,f);has(core,`media/premium/${f}`)});has(media,'w=2400&h=1350');has(media,'if w < 1900 or h < 1000');not(core,'gameMedia=');

// Frozen commercial invariants and release identity.
has(app,'ps5Solo:22');has(app,'ps5Duo:28');has(app,'sim:45');has(app,"defaultPaymentTiming:'start'");has(gradle,'versionCode = 28');has(gradle,'versionName = "2.3.0"');
console.log('V230_SINGLE_DASHBOARD_OK');
console.log('V230_BACK_STACK_OK');
console.log('V230_CASH_POLICY_OK');
console.log('V230_SAAS_DASHBOARD_OK');
console.log('V230_CONTEXT_MEDIA_OK');
console.log('V230_CLIENT_AUDIT_OK');
