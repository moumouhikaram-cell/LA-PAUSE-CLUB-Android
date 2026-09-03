'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const A=path.join(__dirname,'..','app','src','main','assets');
const read=f=>fs.readFileSync(path.join(A,f),'utf8');
const files={
  app:read('app.js'),v15:read('v15.js'),v172:read('v172.js'),
  core:read('p1-core.js'),ops:read('p1-ops.js'),fin:read('p1-finance.js'),commerce:read('p1-commerce.js'),
  device:read('p2-device.js'),fleet:read('p2-fleet.js'),owner:read('p3-owner.js'),intel:read('p3-intelligence.js'),
  player:read('p4-player.js'),experience:read('p4-experience-v2.js'),saas:read('p5-saas.js'),platform:read('p5-platform.js'),
  client:read('client-hardening.js'),dock:read('client-persistent-dock.js'),index:read('index.html'),venue:read('venue-experience.js')
};
const all=Object.values(files).join('\n');
function requires(label,names){for(const name of names)assert(all.includes(name),`${label}: missing ${name}`);console.log(`OK ${label}: ${names.length}`)}
requires('venue operations',['p1OpenVenue','p1CloseVenue','p1SetReadiness','p1CreateTask','p1CompleteTask']);
requires('universal resources',['p1ResourceType','p1RateFor','p1StartUniversalSession','BILLIARD_TABLE','SNOOKER_TABLE','PC_GAMING','SIM_RACING']);
requires('finance',['p1PartialRefund','p1SplitPay','p1CreateGroupTab','p1Receipt']);
requires('commerce',['p1CreateMembership','p1IssueVoucher','p1RedeemVoucher','p1StartStockCount','p1CompleteStockCount','p1ReceiveGoods']);
requires('inventory loyalty',['p1StockMove','p1EarnLoyalty']);
requires('device reliability',['p2QueueCommand','p2ReliabilitySweep']);
requires('maintenance fleet',['p2Fleet','maintenance']);
requires('owner trust',['p3VenueHealth','p3AppendAudit']);
requires('profit intelligence',['p3InventoryBrain','p3MonthlyValueReport']);
requires('player crm',['p4PlayerDna','p4Churn']);
requires('experience',['p4CreateCampaign','p4SmartBookingOptions']);
requires('platform',['p5SupportBundle','p5SchedulerTick']);
requires('client mobile',['clientNativeBack','safe-area-inset-bottom','Business & Cloud','clientPersistentDock']);

const forbidden=[/MASTER V2/i,/EDGE \+ CLOUD/i,/CDC Coverage/i,/System Status/i,/BLOCKED_EXTERNAL/i,/FUTURE_DISABLED/i,/EVENT OUTBOX/i,/CommandEnvelope/i,/3 420 lignes/i];
for(const re of forbidden)assert(!re.test(files.index),`customer index contains developer text: ${re}`);

const menuTargets=[...files.index.matchAll(/data-go="([^"]+)"/g)].map(m=>m[1]);
const routeCorpus=[files.app,files.v15,files.v172,files.core,files.ops,files.fin,files.commerce,files.device,files.fleet,files.owner,files.intel,files.player,files.experience,files.saas,files.platform,files.client,files.venue].join('\n');
const missing=[];
for(const target of [...new Set(menuTargets)]){
  if(!routeCorpus.includes(`'${target}'`)&&!routeCorpus.includes(`\"${target}\"`)&&!routeCorpus.includes(`===${target}`)&&!routeCorpus.includes(target))missing.push(target);
}
assert.deepStrictEqual(missing,[],`unresolved menu targets: ${missing.join(', ')}`);

for(const f of ['media/ps5-available.png','media/sim-vip.png','media/esport-dynamic.png','media/football-dynamic.png','media/racing-dynamic.png'])assert(fs.existsSync(path.join(A,f)),`missing bundled media ${f}`);
console.log(`MENU_TARGETS_OK ${new Set(menuTargets).size}`);
console.log('CLIENT_OPERABILITY_AUDIT_OK');
