'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const index=read('app/src/main/assets/index.html');
const core=read('app/src/main/assets/client-product-core.js');
const v230=read('app/src/main/assets/client-product-v230.js');
const css=read('app/src/main/assets/client-product-v230.css');
const responsive=read('app/src/main/assets/client-product-responsive.css');
const activity=read('app/src/main/java/com/lapauseclub/manager/PremiumActivity.java');
const manifest=read('app/src/main/AndroidManifest.xml');
const gradle=read('app/build.gradle.kts');
const media=read('tools/prepare-client-media-v230.sh');
const has=(t,n,m)=>assert(t.includes(n),m||`Missing ${n}`);
const not=(t,n,m)=>assert(!t.includes(n),m||`Forbidden ${n}`);

// Canonical customer shell + v2.3 refinement only.
['client-product-core.js','client-product-views.js','client-product-setup.js','client-product-v230.js','client-product-boot.js'].forEach(f=>has(index,`src="${f}"`,`missing runtime ${f}`));
['client-shell.js','client-platform-guard.js','client-hardening.js','client-persistent-dock.js','client-final.js','venue-experience.js','p1-floor.js','master-v2-welcome.js'].forEach(f=>not(index,`src="${f}"`,`old renderer loaded: ${f}`));
assert(index.indexOf('client-product-v230.js')>index.indexOf('client-product-setup.js'),'v230 must load after setup');
assert(index.indexOf('client-product-v230.js')<index.indexOf('client-product-boot.js'),'v230 must load before boot');
assert((index.match(/client-product-v230\.js/g)||[]).length===1,'v230 loaded more than once');

// One deterministic back model, persisted across screens/rotation.
['clientNavStack','clientScroll','LP.pushHistory','LP.updateBackControl','window.nativeBack=()=>LP.back(true)','window.clientSwipeBack=()=>LP.back(false)','LP.restoreForm','LP.captureForm'].forEach(x=>has(v230,x,`navigation requirement missing: ${x}`));
has(v230,"b.textContent=home?'☰':'←'",'top-left back arrow missing');
has(v230,'window.setView=function(view)','legacy navigation is not routed through unified history');
has(activity,'registerOnBackInvokedCallback','Android predictive/navbar back callback missing');
has(activity,'this::handleBackRequest','native back must share one handler');
has(activity,'window.nativeBack ? window.nativeBack() : false','native back does not call JS history');
has(manifest,'android:enableOnBackInvokedCallback="true"','predictive back not enabled');
has(manifest,'configChanges="orientation|screenSize|smallestScreenSize|keyboardHidden|uiMode"','rotation preservation missing');
has(responsive,'orientation:landscape','landscape layout missing');
has(responsive,'.cs-dock{display:none}','dock must disappear in landscape/tablet');

// Cash must never block venue operation.
has(v230,'LP.autoOpenOperationalShift','automatic operational shift missing');
has(v230,"eventType:'shift.auto_opened'",'auto shift is not audited');
has(v230,'state.cashSettings.shiftRequired=false','non-cash/deferred bypass missing');
not(v230,"LP.go('cash')",'v230 must not force navigation to cash before a session');

// Modern SaaS owner dashboard.
['cs-saas-home','cs-saas-kpis','cs-saas-main','cs-action-center','PERFORMANCE · 7 JOURS','TOP JEUX DU JOUR','ACTIVITÉ RÉCENTE','ACCÈS RAPIDES'].forEach(x=>has(v230,x,`SaaS dashboard block missing: ${x}`));
['CA AUJOURD’HUI','SESSIONS ACTIVES','OCCUPATION','PANIER MOYEN'].forEach(x=>has(v230,x,`KPI missing: ${x}`));
has(css,'.cs-saas-kpis','SaaS dashboard CSS missing');
has(css,'@media(max-width:679px) and (orientation:portrait)','mobile portrait dashboard missing');
has(css,'@media(orientation:landscape) and (max-height:520px)','compact landscape dashboard missing');

// Contextual HD media: eight distinct venue activities, embedded offline at build time.
const files=['ps5.jpg','sim.jpg','pc.jpg','billiard.jpg','snooker.jpg','table-tennis.jpg','arcade.jpg','lounge.jpg'];
files.forEach(f=>{has(media,f,`media build missing ${f}`);has(v230,`media/premium/${f}`,`runtime media missing ${f}`)});
has(media,'w=2400&h=1350','HD media target missing');
has(media,'if w < 1900 or h < 1000','HD media dimension gate missing');

// Frozen business rates and release identity remain intact.
has(core,"CONSOLE:'PS5'",'PS5 resource mapping missing');
has(gradle,'versionCode = 28');has(gradle,'versionName = "2.3.0"');
const app=read('app/src/main/assets/app.js');
has(app,'ps5Solo:22');has(app,'ps5Duo:28');has(app,'sim:45');

// No developer vocabulary in the new customer layer.
const customer=v230.toUpperCase();
['MASTER V2','SYSTEM STATUS','BLOCKED_EXTERNAL','COMMANDENVELOPE','SQLITE DB','CDC OUTPUT'].forEach(x=>not(customer,x,`developer text leaked: ${x}`));

console.log('V230_UNIFIED_BACK_OK');
console.log('V230_SMART_CASH_OK');
console.log('V230_SAAS_DASHBOARD_OK');
console.log('V230_CONTEXT_MEDIA_OK');
console.log('CLIENT_V230_AUDIT_OK');
