'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const must=(cond,msg)=>{if(!cond){console.error('FAIL:',msg);process.exit(1);}};
const index=read('app/src/main/assets/v250/index.html');
const css=read('app/src/main/assets/v260/canonical.css');
const core=read('app/src/main/assets/v250/saas-core.js');
const runtime=read('app/src/main/assets/v260/canonical-runtime.js');
const uiCore=read('app/src/main/assets/v260/canonical-ui-core.js');
const boards=[
 'board-01-screens-01-05.js','board-02-screens-06-10.js','board-03-screens-11-14.js','board-04-screens-15-19.js','board-05-screens-20-23.js',
 'board-06-screens-24-27.js','board-07-screens-28-31.js','board-08-screens-32-35.js','board-09-screens-36-39.js','board-10-screens-40-44.js'
].map(x=>read('app/src/main/assets/v260/'+x));
const all=boards.join('\n');

must(index.includes('../v260/canonical.css'),'entry must load canonical css');
must(index.includes('../v260/canonical-runtime.js'),'entry must load canonical runtime');
must(!index.includes('screens-45-52.js')&&!index.includes('screens-53-60.js'),'no visible 45-60 legacy screen bundles');
must(!index.includes('app.css')&&!index.includes('responsive.css')&&!index.includes('app.js'),'rejected v2.5 frontend must not load');
must(!all.includes('All 60 Screens')&&!runtime.includes('All 60 Screens'),'no 60-screen picker in visible UI');
must(!all.includes('client-shell-next-v240')&&!runtime.includes('client-shell-next-v240'),'no legacy visual token');

const regs=[...all.matchAll(/U\.register\((\d+),/g)].map(m=>Number(m[1]));
must(regs.length===44,'exactly 44 canonical screen registrations required');
for(let i=1;i<=44;i++)must(regs.includes(i),'missing canonical screen '+i);
must(Math.max(...regs)===44,'no canonical visible screen may exceed 44');
const names=[
'Sales Landing / Home','SaaS Sign In','Create Account','Create Organization','Workspace / Tenant Selector','Venue Selector','Branch Selector','Zero-to-Live Onboarding','Business Model & Pricing Setup','Resource Setup / Floor Builder','Owner Command Center','Operator Control Center','Quick Actions / Revenue Moments','Next Best Action & Alerts','Gaming Floor Overview','New Console Session','New Billiard / Snooker Session (Per Game)','Active Session Cockpit','Session Extensions & Upsell Drawer','POS / Smart Cart','Cash Register / Shift Control','Product Catalog & Inventory Quick Sale','Assisted Revenue / Offer Engine','CRM / Client 360','Memberships / Loyalty / Passes','Bookings Calendar','Queue / Waitlist','Tournaments / Brackets','Devices Fleet Overview','Device Detail / Pairing / Overlay','Incidents / Maintenance','Analytics Overview','Revenue Intelligence / Forecast','Owner Remote Multi-site','Franchise / HQ Controls','Team & RBAC','Subscription / Entitlements / Modules','Integrations / API / Webhooks','White Label / Branding Studio','Settings / Business Config','Security / Audit / Owner Sentinel','Mobile Operator App','Tablet Operator App','Empty / Loading / Offline / Permission Blocked States'];
for(const n of names)must(all.includes("'"+n+"'"),'missing canonical title '+n);

for(let i=1;i<=15;i++)must(core.includes('M'+String(i).padStart(2,'0')+'_'),'missing module M'+String(i).padStart(2,'0'));
for(const token of ['tenantId','workspaceId','venueId','branchId','idempotencyKey','outbox','inbox','syncConflicts','offlineLease'])must(core.includes(token),'missing SaaS/offline token '+token);
for(const token of ['startTimed','startPerGame','extend30','addGame','addSnack','acceptNBA','acceptedActions','assistedRevenue'])must(core.includes(token),'missing operator/revenue token '+token);
for(const token of ['session-duration:30','session-players:2','start-console:','games:1','start-game:','extend30:','add-game:','snack:','accept-nba'])must(all.includes(token)||runtime.includes(token),'missing journey token '+token);
for(const token of ['Inventory & Suppliers','Marketing / Campaigns','Finance & Refunds','Edge + Cloud Sync','Backups & Recovery','Import / Migration','Player PWA','Media & Sponsors','AI Operator','Revenue Lab','Staff Planner','Family / Gift / Referral','History & Forensics'])must(runtime.includes(token),'missing preserved advanced capability '+token);

must(css.includes('@media (orientation:landscape)'),'landscape responsive gate required');
must(css.includes('@media (min-width:700px)'),'tablet responsive gate required');
must(css.includes('[dir="rtl"]'),'RTL gate required');
must(runtime.includes("orientation:window.innerWidth>window.innerHeight?'landscape':'portrait'"),'rotation state tracking required');
must(runtime.includes('window.nativeBack'),'native back/swipe contract required');
for(const token of ['ps5Available','football','esport','combat','racing','sim','billiard','pc','coca','redbull'])must(read('app/src/main/assets/v250/media.js').includes(token),'missing dynamic media '+token);

console.log('PASS: canonical 01-44 UI + SaaS + non-regression + responsive contract');
