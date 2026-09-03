'use strict';
const fs=require('fs'),assert=require('assert');
const A='app/src/main/assets/';
const index=fs.readFileSync(A+'index.html','utf8');
const core=fs.readFileSync(A+'client-product-core.js','utf8');
const scripts=[...index.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
const js=scripts.filter(f=>fs.existsSync(A+f)).map(f=>fs.readFileSync(A+f,'utf8')).join('\n');
// Menu is created dynamically from LP.menuGroups, not from stale data-go markup in index.html.
const block=(core.match(/LP\.menuGroups=\[([\s\S]*?)\n\];/)||[])[1]||'';
assert(block,'LP.menuGroups definition missing');
const routes=[...block.matchAll(/\[\s*'([^']+)'\s*,\s*'[^']+'/g)].map(m=>m[1]);
const shellRoutes=new Set(['csHome','csStations','csOverview','csBilliards','csSetup']);
const knownAliases=new Set(['floor','dashboard','overview','venueResources','veDashboard','veStations','veOverview','veBilliards','veSetup']);
function supported(r){if(shellRoutes.has(r)||knownAliases.has(r))return true;const pats=[`case '${r}'`,`case \"${r}\"`,`currentView==='${r}'`,`currentView===\"${r}\"`,`currentView === '${r}'`,`currentView === \"${r}\"`,`'${r}'`,`\"${r}\"`];return pats.some(p=>js.includes(p));}
const unique=[...new Set(routes)];
assert(unique.length>=30,`visible customer routes unexpectedly low: ${unique.length}`);
const bad=unique.filter(r=>!supported(r));assert.deepStrictEqual(bad,[],`unresolved client menu routes: ${bad.join(', ')}`);
for(const r of unique)assert(!/^(os|systemStatus|platformGovernance|saasWorld|master)/i.test(r),`developer route exposed in menu: ${r}`);
const groups=[...block.matchAll(/title:'([^']+)'/g)].map(m=>m[1]);
assert.deepStrictEqual(groups,['Exploitation','Caisse & ventes','Clients','Animation','Matériel','Pilotage','Gestion'],'menu families changed or incoherent');
console.log('CLIENT_ROUTE_AUDIT_OK');console.log(`VISIBLE_MENU_ROUTES=${unique.length}`);console.log(`MENU_GROUPS=${groups.length}`);
