'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const code=fs.readFileSync(path.resolve(__dirname,'../app/src/main/assets/stabilize-v160-existing.js'),'utf8');
let buttons=[];const make=id=>({dataset:{v15Tab:id},onclick:null});
const ctx={console,Date,JSON,Math,
  state:{cashSettings:{shiftRequired:false},shifts:[],stations:[],sessions:[]},currentView:'floor',selectedStationId:null,sheetDraft:null,
  currentShift:()=>null,startDraftSession:()=>true,openShiftModal:()=>true,
  renderReservationsV15:()=>{buttons=['bookings','passes'].map(make);return true},
  renderClientsV15:()=>{buttons=['crm','cards','consents'].map(make);return true},
  renderCompetitionsV15:mode=>{buttons=['tournaments','challenges','king'].map(make);return mode},
  renderReportsV15:mode=>{buttons=['overview','revenue','occupancy','customers','closure'].map(make);return mode},
  document:{querySelectorAll:sel=>sel==='[data-v15-tab]'?buttons:[],getElementById:()=>null},
  stationById:()=>null,activeSessionFor:()=>null
};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx,{filename:'stabilize-v160-existing.js'});

// Reservations / passes must persist the visible tab as a real route.
ctx.currentView='passes';ctx.renderReservationsV15();let planning=buttons.find(b=>b.dataset.v15Tab==='bookings');
if(!planning||typeof planning.onclick!=='function')throw new Error('Planning tab not rebound');planning.onclick();
if(ctx.currentView!=='reservations')throw new Error(`Planning tab persisted wrong route: ${ctx.currentView}`);
ctx.renderReservationsV15();let passes=buttons.find(b=>b.dataset.v15Tab==='passes');passes.onclick();
if(ctx.currentView!=='passes')throw new Error(`Pass tab persisted wrong route: ${ctx.currentView}`);

// CRM / cards / consents share one renderer but must not jump back after a re-render.
ctx.currentView='mediaConsents';ctx.renderClientsV15();let crm=buttons.find(b=>b.dataset.v15Tab==='crm');
if(!crm||typeof crm.onclick!=='function')throw new Error('CRM tab not rebound');crm.onclick();
if(ctx.currentView!=='clients')throw new Error(`CRM tab persisted wrong route: ${ctx.currentView}`);
ctx.renderClientsV15();let consents=buttons.find(b=>b.dataset.v15Tab==='consents');consents.onclick();
if(ctx.currentView!=='mediaConsents')throw new Error(`Consent tab persisted wrong route: ${ctx.currentView}`);
ctx.renderClientsV15();let cards=buttons.find(b=>b.dataset.v15Tab==='cards');cards.onclick();
if(ctx.currentView!=='clients')throw new Error(`Cards tab persisted wrong route: ${ctx.currentView}`);

// Competition and reports regression cases already observed during stabilization.
ctx.renderCompetitionsV15('tournaments');let king=buttons.find(b=>b.dataset.v15Tab==='king');if(!king||typeof king.onclick!=='function')throw new Error('King tab not rebound');king.onclick();if(ctx.currentView!=='king')throw new Error(`King tab persisted wrong route: ${ctx.currentView}`);
ctx.renderReportsV15('overview');let customers=buttons.find(b=>b.dataset.v15Tab==='customers');if(!customers||typeof customers.onclick!=='function')throw new Error('Customers report tab not rebound');customers.onclick();if(ctx.currentView!=='customerReports')throw new Error(`Customers report persisted wrong route: ${ctx.currentView}`);
console.log('V160_STABILIZATION_TAB_ROUTE_REGRESSION_OK');
