'use strict';
const { test, expect } = require('@playwright/test');

const APP_URL = process.env.LP_E2E_URL || 'http://127.0.0.1:4173/index.html';
test.setTimeout(120000);

async function boot(page){
  await page.setViewportSize({width:412,height:915});
  await page.addInitScript(() => {
    window.ClientAndroid={
      requestExitConfirmation(){},exitApp(){},getSafeInsetsJson(){return JSON.stringify({left:0,top:24,right:0,bottom:24});},
      commitCoreCommand(commandJson,nextStateJson,eventJson){try{return JSON.stringify({ok:true,state:JSON.parse(nextStateJson||'{}'),event:JSON.parse(eventJson||'{}')})}catch(e){return JSON.stringify({ok:false,message:String(e)})}},
      scheduleSessionAlarm(){return true},cancelSessionAlarm(){return true},keepScreenOn(){return true},showTestNotification(){return true},setStateJson(){return true}
    };
    window.Android=window.ClientAndroid;
  });
  const errors=[];
  page.on('pageerror',e=>errors.push(`pageerror: ${e.stack||e.message}`));
  page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`)});
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.LPClient&&document.body.classList.contains('cs-ready'));
  return errors;
}

const LEGACY={
  CONSOLE:'PS5',SIM_RACING:'SIM',PC_GAMING:'PC',BILLIARD_TABLE:'BILLIARD',SNOOKER_TABLE:'SNOOKER',TABLE_TENNIS:'TABLE_TENNIS',PRIVATE_ROOM:'PRIVATE_ROOM',ARCADE:'ARCADE',CUSTOM:'CUSTOM'
};

async function prepare(page,s){
  await page.evaluate(cfg=>{
    state.sessions=[];state.payments=[];state.shifts=[];state.orders=[];
    state.sessionRules=state.sessionRules||{};
    state.sessionRules.defaultPaymentTiming='start';
    state.sessionRules.allowOpenSession=true;
    state.sessionRules.allowPause=true;
    state.rates=state.rates||{};
    state.stations=(state.stations||[]).filter(x=>x.id!==cfg.id);
    state.stations.push({id:cfg.id,name:cfg.name,type:cfg.legacy,osResourceType:cfg.type,enabled:true,maxPlayers:cfg.maxPlayers||2,sort:900,mediaUrl:cfg.media});
    state.ratePlans=(state.ratePlans||[]).filter(p=>!(p.scope==='TYPE'&&String(p.resourceType||'').toUpperCase()===cfg.type));
    state.ratePlans.push({id:`rate-${cfg.id}`,scope:'TYPE',resourceType:cfg.type,name:`${cfg.name} QA`,currency:'MAD',enabled:true,createdAt:Date.now(),updatedAt:Date.now(),revision:1,...cfg.plan});
    if(cfg.type==='CONSOLE'){
      state.rates.ps5Solo=Number(cfg.plan.playerRates?.['1']||cfg.plan.hourlyRate||22);
      state.rates.ps5Duo=Number(cfg.plan.playerRates?.['2']||cfg.plan.hourlyRate||28);
    }
    if(cfg.type==='SIM_RACING'&&cfg.plan.hourlyRate)state.rates.sim=Number(cfg.plan.hourlyRate);
    saveState();window.LPClient.go('csHome');
  },{...s,legacy:LEGACY[s.type]});
  await expect.poll(()=>page.evaluate(()=>window.LPClient.canonical(window.LPClient.lastRendered))).toBe('csHome');
}

async function openJourney(page,id){
  const card=page.locator(`[data-cs-station="${id}"]`);
  await expect(card).toBeVisible();
  const quick=card.locator(`[data-ops-quick-id="${id}"]`);
  if(await quick.count()){
    await expect(quick).toBeVisible();
    await quick.click();
  }else{
    const start=card.locator(`[data-cs-start="${id}"]`).first();
    await expect(start).toBeVisible();
    await start.click();
  }
  await expect(page.locator('#opsSessionForm')).toBeVisible();
  await expect(page.locator('#opsSessionForm')).not.toContainText('Image personnalisée');
  await expect(page.locator('#opsSessionForm input[type="url"]')).toHaveCount(0);
  await expect(page.locator('#opsClient')).toHaveValue('');
  return card;
}

async function activeData(page,id){
  await expect.poll(()=>page.evaluate(x=>!!state.sessions.find(s=>(s.stationId===x||s.resourceId===x)&&s.status==='active'),id)).toBe(true);
  return page.evaluate(x=>{
    const s=state.sessions.find(v=>(v.stationId===x||v.resourceId===x)&&v.status==='active');
    const p=(state.payments||[]).filter(v=>v.sessionId===s?.id).at(-1)||null;
    return {s,p};
  },id);
}

async function assertStartPayment(page,id,amount,model){
  const d=await activeData(page,id);
  expect(d.s.billingModel).toBe(model);
  expect(Number(d.s.totalAmount)).toBeCloseTo(amount,5);
  expect(d.p).toBeTruthy();
  expect(Number(d.p.amount)).toBeCloseTo(amount,5);
  return d;
}

async function settleFinishAndHistory(page,id,name,expectedTotal,semantic){
  const d=await activeData(page,id);
  const sid=d.s.id;
  if(!(await page.locator('.ops-active').count())){
    const card=page.locator(`[data-cs-station="${id}"]`);
    await card.locator('[data-cs-manage]').click();
  }
  await expect(page.locator('#finishBtn')).toBeVisible();
  const due=await page.evaluate(x=>{const s=state.sessions.find(v=>v.id===x),paid=(state.payments||[]).filter(p=>p.sessionId===x).reduce((n,p)=>n+Number(p.amount||0),0);return Math.max(0,Number(s?.totalAmount||0)-paid)},sid);
  if(due>0.009){
    await page.locator('#paymentBtn').click();
    await expect(page.locator('#payConfirm')).toBeVisible();
    expect(Number(await page.locator('#payAmount').inputValue())).toBeCloseTo(due,5);
    await page.locator('#payConfirm').click();
    await expect(page.locator('#finishBtn')).toBeVisible();
  }
  await page.locator('#finishBtn').click();
  await expect(page.locator('#modalOk')).toBeVisible();
  await expect(page.locator('#modalBackdrop')).not.toContainText('reste');
  await page.locator('#modalOk').click();
  await expect.poll(()=>page.evaluate(x=>state.sessions.find(v=>v.id===x)?.status,sid)).toBe('completed');
  const settled=await page.evaluate(x=>{const s=state.sessions.find(v=>v.id===x),paid=(state.payments||[]).filter(p=>p.sessionId===x).reduce((n,p)=>n+Number(p.amount||0),0);return {total:Number(s?.totalAmount||0),paid}},sid);
  expect(settled.total).toBeCloseTo(expectedTotal,5);
  expect(settled.paid).toBeCloseTo(expectedTotal,5);
  await page.evaluate(()=>window.LPClient.go('history'));
  const row=page.locator(`[data-session-row="${sid}"]`);
  await expect(row).toBeVisible();
  await expect(row).toContainText(name);
  await expect(row).toContainText('PAYÉE');
  if(semantic)await expect(row).toContainText(semantic);
  await page.evaluate(()=>window.LPClient.go('csHome'));
  return sid;
}

test('CONSOLE journey: timed Duo preset, optional game, exact quote/payment',async({page})=>{
  const errors=await boot(page);
  const s={id:'qa-console',name:'CONSOLE QA',type:'CONSOLE',maxPlayers:2,media:'media/premium/ps5.jpg',plan:{billingModel:'TIME_PRORATED',pricingModel:'PER_HOUR_PLAYERS',hourlyRate:22,playerRates:{'1':22,'2':28}}};
  await prepare(page,s);let actions=0;await openJourney(page,s.id);actions++;
  await expect(page.locator('[data-ops-mode="budget"]')).toBeVisible();
  await expect(page.locator('[data-ops-players="2"]')).toBeVisible();
  await expect(page.locator('#opsGameTitle')).toHaveCount(1);
  await page.locator('[data-ops-duration="30"]').click();actions++;
  await page.locator('[data-ops-players="2"]').click();actions++;
  await expect(page.locator('.ops-quote strong')).toContainText('14');
  await expect(page.locator('#startSessionBtn')).toContainText('14');
  await page.locator('#startSessionBtn').click();actions++;
  expect(actions).toBeLessThanOrEqual(4);
  const d=await assertStartPayment(page,s.id,14,'TIME_PRORATED');
  expect(Number(d.s.players)).toBe(2);expect(Math.round(Number(d.s.plannedMinutes))).toBe(30);expect(Number(d.s.ratePerHour)).toBe(28);
  await settleFinishAndHistory(page,s.id,s.name,14,'Duo');
  expect(errors).toEqual([]);console.log('V230_JOURNEY_CONSOLE_OK');
});

test('SIM_RACING journey: block package, no player selector, +1 block action',async({page})=>{
  const errors=await boot(page);
  const s={id:'qa-sim',name:'SIM QA',type:'SIM_RACING',maxPlayers:1,media:'media/premium/sim.jpg',plan:{billingModel:'TIME_BLOCK',pricingModel:'TIME_BLOCK',blockMinutes:30,blockPrice:25,unitPrice:25}};
  await prepare(page,s);let actions=0;const card=await openJourney(page,s.id);actions++;
  await expect(page.locator('#opsSessionForm')).toContainText('Bloc de temps');
  await expect(page.locator('#opsSessionForm')).toContainText('Créneau');
  await expect(page.locator('[data-ops-players]')).toHaveCount(0);
  await expect(page.locator('[data-ops-mode="budget"]')).toHaveCount(0);
  await expect(page.locator('#opsGameTitle')).toHaveCount(1);
  await expect(page.locator('.ops-quote strong')).toContainText('25');
  await page.locator('#startSessionBtn').click();actions++;expect(actions).toBeLessThanOrEqual(3);
  let d=await assertStartPayment(page,s.id,25,'TIME_BLOCK');expect(Math.round(Number(d.s.plannedMinutes))).toBe(30);
  await card.locator('[data-cs-manage]').click();await expect(page.locator('#opsAddBlock')).toBeVisible();
  await page.locator('#opsAddBlock').click();
  d=await activeData(page,s.id);expect(Math.round(Number(d.s.plannedMinutes))).toBe(60);expect(Number(d.s.totalAmount)).toBe(50);
  await settleFinishAndHistory(page,s.id,s.name,50,'1 joueur');
  expect(errors).toEqual([]);console.log('V230_JOURNEY_SIM_RACING_OK');
});

test('PC_GAMING journey: budget sale converts amount to minutes and keeps game optional',async({page})=>{
  const errors=await boot(page);
  const s={id:'qa-pc',name:'PC QA',type:'PC_GAMING',maxPlayers:1,media:'media/premium/pc.jpg',plan:{billingModel:'TIME_PRORATED',pricingModel:'FLAT_HOURLY',hourlyRate:30,playerRates:{'1':30}}};
  await prepare(page,s);let actions=0;await openJourney(page,s.id);actions++;
  await expect(page.locator('[data-ops-players]')).toHaveCount(0);
  await expect(page.locator('#opsGameTitle')).toHaveCount(1);
  await expect(page.locator('[data-ops-mode="budget"]')).toBeVisible();
  await page.locator('[data-ops-mode="budget"]').click();actions++;
  await expect(page.locator('#opsBudget')).toBeVisible();await page.locator('#opsBudget').fill('33');
  await expect(page.locator('.ops-quote strong')).toContainText('33');
  await expect(page.locator('#startSessionBtn')).toContainText('33');
  await page.locator('#startSessionBtn').click();actions++;expect(actions).toBeLessThanOrEqual(3);
  const d=await assertStartPayment(page,s.id,33,'TIME_PRORATED');expect(d.s.mode).toBe('budget');expect(Math.round(Number(d.s.plannedMinutes))).toBe(66);
  await settleFinishAndHistory(page,s.id,s.name,33,'1 joueur');
  expect(errors).toEqual([]);console.log('V230_JOURNEY_PC_GAMING_OK');
});

test('BILLIARD_TABLE journey: one game sale, no console fields, +1 game in one action',async({page})=>{
  const errors=await boot(page);
  const s={id:'qa-billiard-journey',name:'BILLARD QA',type:'BILLIARD_TABLE',maxPlayers:4,media:'media/premium/billiard.jpg',plan:{billingModel:'PER_GAME',pricingModel:'PER_GAME',unitPrice:7}};
  await prepare(page,s);let actions=0;const card=await openJourney(page,s.id);actions++;
  await expect(page.locator('#opsSessionForm')).toContainText('Par partie');
  await expect(page.locator('[data-ops-units="1"]')).toBeVisible();
  await expect(page.locator('[data-ops-players="2"]')).toBeVisible();
  await expect(page.locator('#opsGameTitle')).toHaveCount(0);
  await expect(page.locator('[data-ops-mode="budget"]')).toHaveCount(0);
  await expect(page.locator('.ops-quote strong')).toContainText('7');
  await page.locator('#startSessionBtn').click();actions++;expect(actions).toBeLessThanOrEqual(3);
  let d=await assertStartPayment(page,s.id,7,'PER_GAME');expect(Number(d.s.units)).toBe(1);
  await card.locator('[data-cs-manage]').click();await expect(page.locator('#opsAddUnit')).toBeVisible();
  await page.locator('#opsAddUnit').click();
  d=await activeData(page,s.id);expect(Number(d.s.units)).toBe(2);expect(Number(d.s.totalAmount)).toBe(14);
  await settleFinishAndHistory(page,s.id,s.name,14,'2 parties');
  expect(errors).toEqual([]);console.log('V230_JOURNEY_BILLIARD_OK');
});

test('SNOOKER_TABLE journey: per-player game pricing changes quote before start',async({page})=>{
  const errors=await boot(page);
  const s={id:'qa-snooker',name:'SNOOKER QA',type:'SNOOKER_TABLE',maxPlayers:4,media:'media/premium/snooker.jpg',plan:{billingModel:'PER_PLAYER_GAME',pricingModel:'PER_PLAYER_GAME',unitPrice:10,playerRates:{'1':10,'2':14,'3':18,'4':22}}};
  await prepare(page,s);let actions=0;await openJourney(page,s.id);actions++;
  await expect(page.locator('#opsSessionForm')).toContainText('Par partie / joueurs');
  await expect(page.locator('#opsGameTitle')).toHaveCount(0);
  await page.locator('[data-ops-players="2"]').click();actions++;
  await page.locator('[data-ops-units="3"]').click();actions++;
  await expect(page.locator('.ops-quote strong')).toContainText('42');
  await expect(page.locator('#startSessionBtn')).toContainText('42');
  await page.locator('#startSessionBtn').click();actions++;expect(actions).toBeLessThanOrEqual(4);
  const d=await assertStartPayment(page,s.id,42,'PER_PLAYER_GAME');expect(Number(d.s.players)).toBe(2);expect(Number(d.s.units)).toBe(3);expect(Number(d.s.unitPrice)).toBe(14);
  await settleFinishAndHistory(page,s.id,s.name,42,'3 parties');
  expect(errors).toEqual([]);console.log('V230_JOURNEY_SNOOKER_OK');
});

test('TABLE_TENNIS journey: timed group session without game/console noise',async({page})=>{
  const errors=await boot(page);
  const s={id:'qa-table-tennis',name:'PING PONG QA',type:'TABLE_TENNIS',maxPlayers:4,media:'media/premium/table-tennis.jpg',plan:{billingModel:'TIME_PRORATED',pricingModel:'FLAT_HOURLY',hourlyRate:20,playerRates:{'1':20}}};
  await prepare(page,s);let actions=0;await openJourney(page,s.id);actions++;
  await expect(page.locator('#opsGameTitle')).toHaveCount(0);
  await expect(page.locator('[data-ops-mode="budget"]')).toHaveCount(0);
  await expect(page.locator('[data-ops-duration="60"]')).toBeVisible();
  await expect(page.locator('[data-ops-players="2"]')).toBeVisible();
  await page.locator('[data-ops-duration="60"]').click();actions++;
  await page.locator('[data-ops-players="2"]').click();actions++;
  await expect(page.locator('.ops-quote strong')).toContainText('20');
  await page.locator('#startSessionBtn').click();actions++;expect(actions).toBeLessThanOrEqual(4);
  const d=await assertStartPayment(page,s.id,20,'TIME_PRORATED');expect(Number(d.s.players)).toBe(2);expect(Math.round(Number(d.s.plannedMinutes))).toBe(60);
  await settleFinishAndHistory(page,s.id,s.name,20,'2 joueurs');
  expect(errors).toEqual([]);console.log('V230_JOURNEY_TABLE_TENNIS_OK');
});

test('PRIVATE_ROOM journey: fixed package, group capacity, no game fields',async({page})=>{
  const errors=await boot(page);
  const s={id:'qa-private-room',name:'SALLE PRIVÉE QA',type:'PRIVATE_ROOM',maxPlayers:8,media:'media/premium/lounge.jpg',plan:{billingModel:'FIXED_SESSION',pricingModel:'FIXED_SESSION',fixedPrice:120,unitPrice:120,defaultDurationMinutes:120}};
  await prepare(page,s);let actions=0;await openJourney(page,s.id);actions++;
  await expect(page.locator('#opsSessionForm')).toContainText('Prix fixe');
  await expect(page.locator('#opsSessionForm')).toContainText('Session fixe');
  await expect(page.locator('#opsGameTitle')).toHaveCount(0);
  await expect(page.locator('[data-ops-mode="budget"]')).toHaveCount(0);
  await expect(page.locator('[data-ops-players="4"]')).toBeVisible();
  await page.locator('[data-ops-players="4"]').click();actions++;
  await expect(page.locator('.ops-quote strong')).toContainText('120');
  await page.locator('#startSessionBtn').click();actions++;expect(actions).toBeLessThanOrEqual(3);
  const d=await assertStartPayment(page,s.id,120,'FIXED_SESSION');expect(Number(d.s.players)).toBe(4);expect(Math.round(Number(d.s.plannedMinutes))).toBe(120);
  await settleFinishAndHistory(page,s.id,s.name,120,'4 joueurs');
  expect(errors).toEqual([]);console.log('V230_JOURNEY_PRIVATE_ROOM_OK');
});

test('ARCADE journey: per-game sale, optional title, +1 game in one action',async({page})=>{
  const errors=await boot(page);
  const s={id:'qa-arcade-journey',name:'ARCADE QA',type:'ARCADE',maxPlayers:2,media:'media/premium/arcade.jpg',plan:{billingModel:'PER_GAME',pricingModel:'PER_GAME',unitPrice:5}};
  await prepare(page,s);let actions=0;const card=await openJourney(page,s.id);actions++;
  await expect(page.locator('#opsSessionForm')).toContainText('Par partie');
  await expect(page.locator('[data-ops-units="1"]')).toBeVisible();
  await expect(page.locator('[data-ops-players="2"]')).toBeVisible();
  await expect(page.locator('[data-ops-mode="budget"]')).toHaveCount(0);
  await expect(page.locator('#opsGameTitle')).toBeHidden();
  await page.locator('details.ops-more > summary').click();
  await expect(page.locator('#opsGameTitle')).toBeVisible();
  await expect(page.locator('#opsGameTitle')).toHaveValue('Arcade');
  await expect(page.locator('.ops-quote strong')).toContainText('5');
  await page.locator('#startSessionBtn').click();actions++;expect(actions).toBeLessThanOrEqual(3);
  let d=await assertStartPayment(page,s.id,5,'PER_GAME');expect(Number(d.s.units)).toBe(1);
  await card.locator('[data-cs-manage]').click();await expect(page.locator('#opsAddUnit')).toBeVisible();
  await page.locator('#opsAddUnit').click();
  d=await activeData(page,s.id);expect(Number(d.s.units)).toBe(2);expect(Number(d.s.totalAmount)).toBe(10);
  expect(errors).toEqual([]);console.log('V230_JOURNEY_ARCADE_OK');
});

test('CUSTOM journey: operator-entered amount becomes the exact payable amount',async({page})=>{
  const errors=await boot(page);
  const s={id:'qa-custom',name:'ACTIVITÉ QA',type:'CUSTOM',maxPlayers:6,media:'media/premium/arcade.jpg',plan:{billingModel:'CUSTOM_AMOUNT',pricingModel:'CUSTOM_AMOUNT',unitPrice:0}};
  await prepare(page,s);let actions=0;await openJourney(page,s.id);actions++;
  await expect(page.locator('#opsSessionForm')).toContainText('Montant libre');
  await expect(page.locator('#opsCustomAmount')).toBeVisible();
  await expect(page.locator('#opsGameTitle')).toHaveCount(0);
  await expect(page.locator('[data-ops-mode="budget"]')).toHaveCount(0);
  await page.locator('#opsCustomAmount').fill('37.5');
  await expect(page.locator('.ops-quote strong')).toContainText('37');
  await expect(page.locator('#startSessionBtn')).toBeEnabled();
  await expect(page.locator('#startSessionBtn')).toContainText('37');
  await page.locator('#startSessionBtn').click();actions++;expect(actions).toBeLessThanOrEqual(3);
  const d=await assertStartPayment(page,s.id,37.5,'CUSTOM_AMOUNT');expect(Number(d.s.players)).toBe(1);
  await settleFinishAndHistory(page,s.id,s.name,37.5,'Montant libre');
  expect(errors).toEqual([]);console.log('V230_JOURNEY_CUSTOM_OK');
});

test('all game/resource journeys are explicitly represented',async({page})=>{
  await boot(page);
  const types=await page.evaluate(()=>Object.keys(window.LPClient.opsProfiles||{}));
  expect(types.sort()).toEqual(['ARCADE','BILLIARD_TABLE','CONSOLE','CUSTOM','PC_GAMING','PRIVATE_ROOM','SIM_RACING','SNOOKER_TABLE','TABLE_TENNIS'].sort());
  console.log('V230_ALL_GAME_JOURNEYS_OK '+types.join(','));
});
