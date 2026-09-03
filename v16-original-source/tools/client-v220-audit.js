'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),A=path.join(root,'app/src/main/assets');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const index=read('app/src/main/assets/index.html');
const core=read('app/src/main/assets/client-product-core.js');
const views=read('app/src/main/assets/client-product-views.js');
const setup=read('app/src/main/assets/client-product-setup.js');
const css=read('app/src/main/assets/client-product-core.css');
const responsive=read('app/src/main/assets/client-product-responsive.css');
const activity=read('app/src/main/java/com/lapauseclub/manager/PremiumActivity.java');
const manifest=read('app/src/main/AndroidManifest.xml');
const gradle=read('app/build.gradle.kts');

function has(text,needle,msg){assert(text.includes(needle),msg||`Missing ${needle}`)}
function not(text,needle,msg){assert(!text.includes(needle),msg||`Forbidden ${needle}`)}

// Exactly one customer rendering shell is loaded. Legacy domain/business modules may remain behind it.
['client-product-core.js','client-product-views.js','client-product-setup.js','client-product-boot.js'].forEach(f=>has(index,`src="${f}"`,`index must load ${f}`));
['client-shell.js','client-platform-guard.js','client-hardening.js','client-persistent-dock.js','client-final.js','venue-experience.js','p1-floor.js','master-v2-welcome.js'].forEach(f=>not(index,`src="${f}"`,`old renderer must not be loaded: ${f}`));
assert((index.match(/client-product-core\.js/g)||[]).length===1,'client core must load once');
assert((index.match(/client-product-views\.js/g)||[]).length===1,'client views must load once');

// One dashboard route, one stations route, one overview route.
has(views,'LP.views.csHome=','single home view missing');
has(views,'LP.views.csStations=','stations view missing');
has(views,'LP.views.csOverview=','overview view missing');
assert((views.match(/LP\.views\.csHome=/g)||[]).length===1,'more than one customer dashboard');

// Intelligent information architecture: seven concise business families + search.
const groups=['Exploitation','Caisse & ventes','Clients','Animation','Matériel','Pilotage','Gestion'];
groups.forEach(g=>has(core,`title:'${g}'`,`missing menu family ${g}`));
has(core,'csMenuSearch','menu search missing');has(core,'Rechercher une fonction','search copy missing');
const visibleRoutes=['csStations','sessions','reservations','queue','history','cash','orders','products','purchases','clients','passes','loyalty','offers','tournaments','king','challenges','leaderboard','campaigns','equipment','controllers','inventory','maintenance','incidents','csOverview','revenue','customerReports','closure','team','csSetup','settings','dataControl'];
visibleRoutes.forEach(r=>has(core,`'${r}'`,`visible route not declared: ${r}`));
const businessFiles=['app/src/main/assets/app.js','app/src/main/assets/v13.js','app/src/main/assets/v14.js','app/src/main/assets/v15.js','app/src/main/assets/v17.js','app/src/main/assets/v171.js','app/src/main/assets/v172.js','app/src/main/assets/p1-ops.js','app/src/main/assets/p1-finance.js','app/src/main/assets/p1-commerce.js','app/src/main/assets/p2-device.js','app/src/main/assets/p2-fleet.js','app/src/main/assets/p3-owner.js','app/src/main/assets/p3-intelligence.js','app/src/main/assets/p4-player.js','app/src/main/assets/p4-experience-v2.js','app/src/main/assets/p5-saas.js','app/src/main/assets/p5-platform.js'].filter(p=>fs.existsSync(path.join(root,p)));
const business=businessFiles.map(read).join('\n');
visibleRoutes.filter(r=>!['csStations','csOverview','csSetup'].includes(r)).forEach(r=>assert(business.includes(`'${r}'`)||business.includes(`"${r}"`)||business.includes(`=${r}`)||business.includes(` ${r}`),`no implementation marker found for visible route ${r}`));

// Mobile portrait, landscape and tablet must have distinct navigation layouts.
has(responsive,'@media (min-width:820px)','tablet layout missing');
has(responsive,'orientation:landscape','landscape layout missing');
has(responsive,'.cs-rail','landscape/tablet rail missing');
has(responsive,'.cs-dock{display:none}','bottom dock must disappear on wide/landscape');
has(css,'safe-area-inset-bottom','safe bottom missing');has(css,'--cs-native-bottom','native bottom inset missing');
has(core,'onLaPauseViewportChanged','viewport change hook missing');has(core,'cs-compact-landscape','compact landscape strategy missing');

// Native activity preserves WebView across rotation and provides one guarded exit path.
has(manifest,'configChanges="orientation|screenSize|smallestScreenSize|keyboardHidden|uiMode"','manifest rotation preservation missing');
has(activity,'onConfigurationChanged','native rotation callback missing');
has(activity,'requestApplyInsets','insets refresh missing');
has(activity,'onLaPauseViewportChanged','JS viewport callback missing');
has(activity,'getSafeInsetsJson','native safe inset bridge missing');
has(activity,'requestExitConfirmation','native exit confirmation bridge missing');
has(activity,'Quitter LA PAUSE OS ?','exit confirmation copy missing');
assert(!/public void exitApp\(\)[\s\S]{0,180}finishAndRemoveTask\(\)/.test(activity),'exitApp bypasses confirmation');

// Setup is safe and complete.
has(setup,'LP.validateSetupStep','setup validation missing');has(setup,'Tarif obligatoire','missing rate validation');has(setup,"active.has(st.id)",'active resource protection missing');has(setup,'st.enabled=false','non-destructive resource disable missing');
['CONSOLE','SIM_RACING','PC_GAMING','BILLIARD_TABLE','SNOOKER_TABLE','TABLE_TENNIS','PRIVATE_ROOM','CUSTOM'].forEach(t=>has(core,t,`resource type missing ${t}`));

// Customer shell must never expose implementation/developer vocabulary.
const customerText=(core+'\n'+views+'\n'+setup).toUpperCase();
['MASTER V2','SYSTEM STATUS','BLOCKED_EXTERNAL','COMMANDENVELOPE','DOMAIN EVENT','SQLITE DB','CDC OUTPUT','PHASE 1 ·','EDGE + CLOUD'].forEach(x=>not(customerText,x,`developer text leaked: ${x}`));

has(gradle,'versionCode = 27');has(gradle,'versionName = "2.2.0"');has(manifest,'android:name=".PremiumActivity"');has(manifest,'android:label="LA PAUSE OS"');
console.log('SINGLE_DASHBOARD_OK');
console.log('MENU_GROUPS_OK');
console.log('RESPONSIVE_ROTATION_OK');
console.log('CLIENT_V220_AUDIT_OK');
