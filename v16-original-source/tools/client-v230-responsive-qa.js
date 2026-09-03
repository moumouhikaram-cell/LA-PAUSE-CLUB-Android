'use strict';
const fs=require('fs'),assert=require('assert');
const A='app/src/main/assets/';
const css=fs.readFileSync(A+'client-product-core.css','utf8')+'\n'+fs.readFileSync(A+'client-product-responsive.css','utf8')+'\n'+fs.readFileSync(A+'client-product-v230.css','utf8');
const core=fs.readFileSync(A+'client-product-core.js','utf8');
const manifest=fs.readFileSync('app/src/main/AndroidManifest.xml','utf8');
const activity=fs.readFileSync('app/src/main/java/com/lapauseclub/manager/PremiumActivity.java','utf8');
function has(s,x,m){assert(s.includes(x),m||`missing ${x}`)}
// Four UX environments are intentionally handled.
has(css,'@media (max-width:380px)','narrow phone rules missing');
has(css,'@media (max-width:679px) and (orientation:portrait)','phone portrait rules missing');
has(css,'orientation:landscape','landscape rules missing');
has(css,'@media (min-width:820px)','tablet rules missing');
has(css,'.cs-dock{display:none}','dock must disappear on landscape/tablet');
has(css,'.cs-rail','rail styling missing');
has(core,'cs-compact-landscape','compact landscape runtime missing');
has(core,'--cs-vh','dynamic viewport height missing');
// Safe-area contract must cover all four edges and Android native insets.
for(const x of ['safe-area-inset-top','safe-area-inset-bottom','safe-area-inset-left','safe-area-inset-right','--cs-native-top','--cs-native-bottom','--cs-native-left','--cs-native-right'])has(css,x,`safe-area piece missing ${x}`);
has(activity,'getSafeInsetsJson','native insets bridge missing');has(activity,'requestApplyInsets','native inset refresh missing');
// Rotation must preserve activity/WebView rather than restarting the app.
has(manifest,'orientation|screenSize|smallestScreenSize|keyboardHidden|uiMode','rotation configChanges missing');has(activity,'onConfigurationChanged','rotation callback missing');has(activity,'onLaPauseViewportChanged','JS viewport update missing');
// Touch ergonomics: customer chrome and primary controls need explicit usable sizes.
const minTouchRules=[/\.cs-back[^\{]*\{[^}]*width:\s*(4[0-9]|[5-9][0-9])px[^}]*height:\s*(4[0-9]|[5-9][0-9])px/s,/\.cs-menu[^\{]*\{[^}]*width:\s*(4[0-9]|[5-9][0-9])px[^}]*height:\s*(4[0-9]|[5-9][0-9])px/s];
for(const r of minTouchRules)assert(r.test(css),`primary topbar touch target below ~40px: ${r}`);
// Bottom dock must respect native bottom inset rather than sitting on Android navbar.
has(css,'bottom:max(8px,var(--cs-safe-bottom))','dock bottom safe-area missing');
// Customer view should never use body-level horizontal scroll as a crutch.
assert(!/body[^\{]*\{[^}]*overflow-x:\s*(scroll|auto)/s.test(css),'body horizontal scrolling is not allowed');
console.log('PHONE_NARROW_CONTRACT_OK');
console.log('PHONE_PORTRAIT_CONTRACT_OK');
console.log('LANDSCAPE_CONTRACT_OK');
console.log('TABLET_CONTRACT_OK');
console.log('SAFE_AREA_CONTRACT_OK');
console.log('RESPONSIVE_ERGONOMICS_AUDIT_OK');
