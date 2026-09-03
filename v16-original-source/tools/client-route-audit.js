'use strict';
const fs=require('fs'),assert=require('assert');
const A='app/src/main/assets/';
const index=fs.readFileSync(A+'index.html','utf8');
const scripts=[...index.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
const js=scripts.filter(f=>fs.existsSync(A+f)).map(f=>fs.readFileSync(A+f,'utf8')).join('\n');
const routes=[...index.matchAll(/data-go="([^"]+)"/g)].map(m=>m[1]);
const shellRoutes=new Set(['csHome','csStations','csOverview','csBilliards','csSetup']);
const knownAliases=new Set(['floor','dashboard','overview','venueResources','veDashboard','veStations','veOverview','veBilliards','veSetup']);
function supported(r){if(shellRoutes.has(r)||knownAliases.has(r)||r==='more')return true;const pats=[`case '${r}'`,`case \"${r}\"`,`currentView==='${r}'`,`currentView===\"${r}\"`,`currentView === '${r}'`,`currentView === \"${r}\"`];return pats.some(p=>js.includes(p));}
const unique=[...new Set(routes)];const bad=unique.filter(r=>!supported(r));assert.deepStrictEqual(bad,[],`unresolved client menu routes: ${bad.join(', ')}`);for(const r of unique)assert(!/^os|systemStatus|platformGovernance|saasWorld/.test(r),`developer route exposed in static menu: ${r}`);console.log('CLIENT_ROUTE_AUDIT_OK');console.log(`VISIBLE_MENU_ROUTES=${unique.length}`);
