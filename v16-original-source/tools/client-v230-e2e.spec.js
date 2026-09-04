'use strict';
const { test, expect } = require('@playwright/test');

const APP_URL = process.env.LP_E2E_URL || 'http://127.0.0.1:4173/index.html';
const forbiddenClientText = [/Master\s*V2/i,/\bSQLite\b/i,/\bCDC\b/i,/\bdebug\b/i,/\bP[1-5]\s*(phase|runtime|module)\b/i];

test.setTimeout(120000);

async function boot(page, viewport={width:412,height:915}) {
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    window.__lpExitRequests = 0;
    window.ClientAndroid = {
      requestExitConfirmation(){ window.__lpExitRequests += 1; },
      exitApp(){ window.__lpExitRequests += 1; },
      getSafeInsetsJson(){ return JSON.stringify({left:0,top:24,right:0,bottom:24}); },
      commitCoreCommand(commandJson,nextStateJson,eventJson){
        try{
          const next=JSON.parse(nextStateJson||'{}');
          const event=JSON.parse(eventJson||'{}');
          const command=JSON.parse(commandJson||'{}');
          return JSON.stringify({ok:true,state:next,event,commandId:command.commandId||null});
        }catch(e){return JSON.stringify({ok:false,message:e.message||String(e)});}
      },
      scheduleSessionAlarm(){ return true; },
      cancelSessionAlarm(){ return true; },
      keepScreenOn(){ return true; },
      showTestNotification(){ return true; },
      setStateJson(){ return true; }
    };
    window.Android=window.ClientAndroid;
  });
  const errors=[];
  page.on('pageerror', e => errors.push(`pageerror: ${e.stack||e.message}`));
  page.on('console', m => { if(m.type()==='error') errors.push(`console: ${m.text()}`); });
  await page.goto(APP_URL, {waitUntil:'networkidle'});
  await page.waitForFunction(() => !!window.LPClient && document.body.classList.contains('cs-ready'));
  return errors;
}

async function currentRoute(page){return page.evaluate(() => window.LPClient.canonical(window.LPClient.lastRendered));}
async function goHome(page){await page.evaluate(() => window.LPClient.go('csHome')); await expect.poll(()=>currentRoute(page)).toBe('csHome');}

async function assertChrome(page){
  await expect(page.locator('#csTop')).toHaveCount(1);
  await expect(page.locator('#csDock')).toHaveCount(1);
  await expect(page.locator('#csRail')).toHaveCount(1);
  await expect(page.locator('#legacyBridge')).toBeHidden();
  await expect(page.locator('#view')).not.toBeEmpty();
}

async function clientTextViolations(page){
  const text=await page.locator('body').innerText();
  return forbiddenClientText.filter(r=>r.test(text)).map(r=>String(r));
}

async function sessionDiagnostic(page){
  return page.evaluate(() => ({
    overlayClass:document.querySelector('#overlay')?.className||'',
    overlayText:(document.querySelector('#overlay')?.innerText||'').slice(-1200),
    toast:document.querySelector('#toast')?.textContent||'',
    sessions:(state.sessions||[]).map(s=>({id:s.id,stationId:s.stationId,resourceId:s.resourceId,status:s.status,ratePerHour:s.ratePerHour,unitPrice:s.unitPrice,players:s.players,paymentStatus:s.paymentStatus})).slice(-10),
    shifts:(state.shifts||[]).map(s=>({id:s.id,status:s.status,openingCash:s.openingCash,autoOpened:s.autoOpened})).slice(-5),
    payments:(state.payments||[]).map(p=>({id:p.id,amount:p.amount,shiftId:p.shiftId,method:p.method,sessionId:p.sessionId})).slice(-10)
  }));
}

async function finishActiveStation(page,stationId){
  const card=page.locator(`[data-cs-station="${stationId}"]`);
  await card.locator('[data-cs-manage]').click();
  await expect(page.locator('#finishBtn')).toBeVisible();
  await page.locator('#finishBtn').click();
  if(await page.locator('#modalOk').count()){
    await expect(page.locator('#modalOk')).toBeVisible();
    await page.locator('#modalOk').click();
  }
  await expect.poll(()=>page.evaluate(id=>state.sessions.some(s=>(s.stationId===id||s.resourceId===id)&&['active','paused'].includes(s.status)),stationId)).toBe(false);
}

test('boot has a single customer shell and no client-visible developer language', async ({page}) => {
  const errors=await boot(page);
  await assertChrome(page);
  await expect.poll(()=>currentRoute(page)).toBe('csHome');
  expect(await clientTextViolations(page)).toEqual([]);
  if(errors.length) console.error('BOOT_RUNTIME_ERRORS\n'+errors.join('\n'));
  expect(errors).toEqual([]);
  console.log('V230_SINGLE_RUNTIME_E2E_OK');
});

test('every customer menu route opens by real clicks and returns exactly to Home', async ({page}) => {
  const errors=await boot(page);
  const map=await page.evaluate(() => window.LPClient.menuGroups.map(g=>({id:g.id,title:g.title,items:g.items.map(i=>({route:i[0],label:i[1]}))})));
  const failures=[];
  let clicked=0;
  for(const group of map){
    for(const item of group.items){
      try{
        await goHome(page);
        await page.locator('#csMore').click();
        await expect(page.locator('#csMenuPanel')).toHaveClass(/show/);
        await page.locator(`[data-menu-group="${group.id}"]`).click();
        const target=page.locator(`[data-menu-route="${item.route}"]`);
        await expect(target).toBeVisible();
        await target.click();
        await expect.poll(()=>currentRoute(page)).toBe(item.route);
        await expect(page.locator('#view')).not.toBeEmpty();
        const text=(await page.locator('#view').innerText()).trim();
        if(text.length<3) throw new Error('vue vide');
        const dev=await clientTextViolations(page);
        if(dev.length) throw new Error(`texte développeur visible: ${dev.join(', ')}`);
        await assertChrome(page);
        await page.locator('#csBack').click();
        await expect.poll(()=>currentRoute(page)).toBe('csHome');
        clicked++;
      }catch(e){
        failures.push(`${group.title} > ${item.label} (${item.route}): ${e.message}`);
      }
    }
  }
  if(failures.length) console.error('ROUTE FAILURES\n'+failures.join('\n'));
  if(errors.length) console.error('ROUTE_RUNTIME_ERRORS\n'+errors.join('\n'));
  expect(failures, failures.join('\n')).toEqual([]);
  expect(clicked).toBe(map.reduce((n,g)=>n+g.items.length,0));
  expect(errors).toEqual([]);
  console.log(`V230_ALL_ROUTES_CLICK_OK ${clicked}`);
});

test('back stack, transient overlays, legacy direct routes and Home exit are deterministic', async ({page}) => {
  const errors=await boot(page);
  await page.locator('#csDock [data-cs-go="csStations"]').click();
  await expect.poll(()=>currentRoute(page)).toBe('csStations');
  await page.locator('[data-cs-go="csSetup"]').first().click();
  await expect.poll(()=>currentRoute(page)).toBe('csSetup');
  await page.locator('#csBack').click();
  await expect.poll(()=>currentRoute(page)).toBe('csStations');
  await page.locator('#csBack').click();
  await expect.poll(()=>currentRoute(page)).toBe('csHome');

  await page.evaluate(() => { window.LPClient.go('csStations'); });
  await expect.poll(()=>currentRoute(page)).toBe('csStations');
  await page.evaluate(() => { window.setView('clients'); });
  await expect.poll(()=>currentRoute(page)).toBe('clients');
  await page.locator('#csBack').click();
  await expect.poll(()=>currentRoute(page)).toBe('csStations');

  const start=page.locator('[data-cs-start]').first();
  await expect(start).toBeVisible();
  await start.click();
  await expect(page.locator('#overlay')).toHaveClass(/show/);
  await page.evaluate(() => window.nativeBack());
  await expect(page.locator('#overlay')).not.toHaveClass(/show/);
  await expect.poll(()=>currentRoute(page)).toBe('csStations');

  await page.locator('#csDock [data-cs-go="csHome"]').click();
  await expect.poll(()=>currentRoute(page)).toBe('csHome');
  await expect(page.locator('#csBack')).toHaveClass(/hidden/);
  await page.evaluate(() => window.nativeBack());
  await expect.poll(()=>page.evaluate(()=>window.__lpExitRequests)).toBe(1);
  await expect.poll(()=>currentRoute(page)).toBe('csHome');
  if(errors.length) console.error('BACK_RUNTIME_ERRORS\n'+errors.join('\n'));
  expect(errors).toEqual([]);
  console.log('V230_BACK_HOME_EXIT_OK');
});

test('portrait-landscape rotation preserves route, form value, scroll and one navigation shell', async ({page}) => {
  const errors=await boot(page);
  await page.evaluate(() => window.LPClient.go('csSetup'));
  await expect.poll(()=>currentRoute(page)).toBe('csSetup');
  const editable=page.locator('#view input:not([type="file"]):not([type="hidden"]),#view textarea,#view select').first();
  await expect(editable).toBeVisible();
  const tag=await editable.evaluate(el=>el.tagName);
  let expected;
  if(tag==='SELECT'){
    const options=await editable.locator('option').evaluateAll(os=>os.map(o=>o.value).filter(Boolean));
    if(options.length){expected=options[Math.min(1,options.length-1)];await editable.selectOption(expected);}else expected=await editable.inputValue();
  }else{
    const type=await editable.getAttribute('type');
    expected=type==='number'?'123':'QA-ROTATION-PRESERVED';
    await editable.fill(expected);
  }
  await page.evaluate(() => scrollTo(0, Math.min(450, Math.max(0, document.documentElement.scrollHeight-innerHeight))));
  const before=await page.evaluate(()=>({route:window.LPClient.canonical(window.LPClient.lastRendered),y:scrollY}));
  await page.setViewportSize({width:915,height:412});
  await page.evaluate(() => window.onLaPauseViewportChanged && window.onLaPauseViewportChanged());
  await page.waitForTimeout(250);
  expect(await currentRoute(page)).toBe(before.route);
  await expect(page.locator('#csDock')).toBeHidden();
  await expect(page.locator('#csRail')).toBeVisible();
  expect(await editable.inputValue()).toBe(expected);
  await assertChrome(page);
  await page.setViewportSize({width:412,height:915});
  await page.evaluate(() => window.onLaPauseViewportChanged && window.onLaPauseViewportChanged());
  await page.waitForTimeout(250);
  expect(await currentRoute(page)).toBe(before.route);
  expect(await editable.inputValue()).toBe(expected);
  const afterY=await page.evaluate(()=>scrollY);
  expect(Math.abs(afterY-before.y)).toBeLessThanOrEqual(16);
  if(errors.length) console.error('ROTATION_RUNTIME_ERRORS\n'+errors.join('\n'));
  expect(errors).toEqual([]);
  console.log('V230_ROTATION_PROGRESS_OK');
});

test('real customer PS5 session flow auto-opens cash shift and updates dashboard/cash/history', async ({page}) => {
  const errors=await boot(page);
  await page.locator('#csDock [data-cs-go="csStations"]').click();
  const start=page.locator('[data-cs-start]').first();
  await expect(start).toBeVisible();
  await start.click();
  await expect(page.locator('#startSessionBtn')).toBeVisible();
  await expect(page.locator('.ops-payment-line')).toContainText('Paiement au démarrage');
  await expect(page.locator('#startSessionBtn')).toContainText('Encaisser');
  const duration30=page.locator('[data-ops-duration="30"]');
  if(await duration30.count()) await duration30.click();
  const duo=page.locator('[data-ops-players="2"]');
  const duoAvailable=(await duo.count())>0;
  if(duoAvailable) await duo.click();
  await page.locator('#startSessionBtn').click();
  const postStart=await sessionDiagnostic(page);
  console.log('PS5_POST_START_DIAGNOSTIC '+JSON.stringify(postStart));
  if(errors.length) console.error('PS5_RUNTIME_ERRORS\n'+errors.join('\n'));
  await expect(page.locator('#overlay')).not.toHaveClass(/show/);
  const state1=await page.evaluate(() => ({
    active:state.sessions.filter(s=>s.status==='active').length,
    activeSession:state.sessions.find(s=>s.status==='active')||null,
    payments:state.payments.length,
    shifts:state.shifts.filter(s=>s.status==='open').map(s=>({id:s.id,openingCash:s.openingCash,autoOpened:s.autoOpened})),
    paymentShift:state.payments.at(-1)?.shiftId||null,
    toasts:document.querySelector('#toast')?.textContent||''
  }));
  expect(state1.active).toBe(1);
  expect(state1.activeSession).toBeTruthy();
  if(duoAvailable){expect(Number(state1.activeSession.ratePerHour)).toBe(28);expect(Number(state1.activeSession.players)).toBe(2);}
  expect(state1.payments).toBe(1);
  expect(state1.shifts).toHaveLength(1);
  expect(state1.shifts[0].openingCash).toBe(0);
  expect(state1.shifts[0].autoOpened).toBe(true);
  expect(state1.paymentShift).toBe(state1.shifts[0].id);
  expect(state1.toasts).not.toContain('Ouvre d’abord un shift de caisse');

  await page.locator('#csDock [data-cs-go="csHome"]').click();
  await expect(page.locator('.cs-kpi').filter({hasText:'SESSIONS ACTIVES'})).toContainText('1');
  const revenue=await page.evaluate(() => window.LPClient.revenue());
  expect(revenue).toBeGreaterThan(0);

  await page.locator('#csDock [data-cs-go="csStations"]').click();
  await finishActiveStation(page,state1.activeSession.stationId||state1.activeSession.resourceId);
  const state2=await page.evaluate(() => ({active:state.sessions.filter(s=>s.status==='active'||s.status==='paused').length,completed:state.sessions.filter(s=>s.status==='completed').length,payments:state.payments.length,shifts:state.shifts.filter(s=>s.status==='open').length}));
  expect(state2.active).toBe(0);
  expect(state2.completed).toBeGreaterThanOrEqual(1);
  expect(state2.payments).toBeGreaterThanOrEqual(1);
  expect(state2.shifts).toBe(1);

  await page.evaluate(() => window.LPClient.go('history'));
  await expect(page.locator('#view')).not.toBeEmpty();
  await page.evaluate(() => window.LPClient.go('cash'));
  await expect(page.locator('#view')).not.toBeEmpty();
  expect(errors).toEqual([]);
  console.log('V230_SESSION_CLICK_FLOW_OK');
});

test('SIM session can be started and managed from the same customer station surface', async ({page}) => {
  const errors=await boot(page);
  await page.locator('#csDock [data-cs-go="csStations"]').click();
  const simCard=page.locator('[data-cs-station="sim-1"]');
  await expect(simCard).toBeVisible();
  await simCard.locator('[data-cs-start]').click();
  await expect(page.locator('#startSessionBtn')).toBeVisible();
  await page.locator('#startSessionBtn').click();
  const postStart=await sessionDiagnostic(page);
  console.log('SIM_POST_START_DIAGNOSTIC '+JSON.stringify(postStart));
  if(errors.length) console.error('SIM_RUNTIME_ERRORS\n'+errors.join('\n'));
  const sim=await page.evaluate(()=>state.sessions.find(s=>(s.stationId==='sim-1'||s.resourceId==='sim-1')&&s.status==='active'));
  expect(sim).toBeTruthy();
  expect(Number(sim.ratePerHour)).toBe(45);
  await finishActiveStation(page,'sim-1');
  expect(errors).toEqual([]);
  console.log('V230_SIM_CLICK_FLOW_OK');
});

test('type-aware billing makes billiard a two-action per-game sale', async ({page}) => {
  const errors=await boot(page);
  await page.evaluate(() => {
    state.stations=state.stations.filter(s=>s.id!=='qa-billiard');
    state.stations.push({id:'qa-billiard',name:'BILLARD QA',type:'BILLIARD',osResourceType:'BILLIARD_TABLE',enabled:true,maxPlayers:2,sort:80,mediaUrl:'media/premium/billiard.jpg'});
    state.ratePlans=(state.ratePlans||[]).filter(p=>p.resourceType!=='BILLIARD_TABLE');
    state.ratePlans.push({id:'rate-qa-billiard',scope:'TYPE',resourceType:'BILLIARD_TABLE',name:'Billard par partie',billingModel:'PER_GAME',pricingModel:'PER_GAME',unitPrice:7,hourlyRate:0,playerRates:{},currency:'MAD',enabled:true,createdAt:Date.now(),updatedAt:Date.now(),revision:1});
    saveState(); window.LPClient.go('csHome');
  });
  const card=page.locator('[data-cs-station="qa-billiard"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('7');
  await expect(card).toContainText('/ partie');
  await expect(card).not.toContainText('/ h');
  let actions=0;
  await card.locator('[data-ops-quick-id="qa-billiard"]').click(); actions++;
  await expect(page.locator('#opsSessionForm')).toBeVisible();
  await expect(page.locator('#opsSessionForm')).toContainText('Par partie');
  await expect(page.locator('#opsSessionForm')).not.toContainText('Budget client');
  await expect(page.locator('#opsGameTitle')).toHaveCount(0);
  await expect(page.locator('#gameCoverP1,#gameCoverV12')).toHaveCount(0);
  await page.locator('#startSessionBtn').click(); actions++;
  expect(actions).toBeLessThanOrEqual(2);
  const first=await page.evaluate(()=>({s:state.sessions.find(x=>(x.stationId==='qa-billiard'||x.resourceId==='qa-billiard')&&x.status==='active'),p:state.payments.at(-1)}));
  expect(first.s).toBeTruthy(); expect(first.s.billingModel).toBe('PER_GAME'); expect(Number(first.s.totalAmount)).toBe(7); expect(Number(first.s.ratePerHour||0)).toBe(0); expect(Number(first.p.amount)).toBe(7);
  await card.locator('[data-cs-manage]').click();
  await expect(page.locator('#opsAddUnit')).toBeVisible();
  await page.locator('#opsAddUnit').click();
  const second=await page.evaluate(()=>state.sessions.find(x=>(x.stationId==='qa-billiard'||x.resourceId==='qa-billiard')&&x.status==='active'));
  expect(Number(second.units)).toBe(2); expect(Number(second.totalAmount)).toBe(14);
  expect(errors).toEqual([]);
  console.log('V230_BILLING_SEMANTICS_OK');
});

test('PS5 Duo 30 minutes is reachable in three sale actions with exact quote and payment', async ({page}) => {
  const errors=await boot(page);
  await page.evaluate(()=>window.LPClient.go('csHome'));
  const card=page.locator('[data-cs-station="ps5-1"]'); await expect(card).toBeVisible();
  let actions=0;
  await card.locator('[data-ops-quick-id="ps5-1"]').click(); actions++;
  await expect(page.locator('#opsSessionForm')).toBeVisible();
  const duo=page.locator('[data-ops-players="2"]'); await expect(duo).toBeVisible(); await duo.click(); actions++;
  await expect(page.locator('.ops-quote')).toContainText('14');
  await page.locator('#startSessionBtn').click(); actions++;
  expect(actions).toBeLessThanOrEqual(3);
  const data=await page.evaluate(()=>({s:state.sessions.find(x=>(x.stationId==='ps5-1'||x.resourceId==='ps5-1')&&x.status==='active'),p:state.payments.at(-1)}));
  expect(Number(data.s.players)).toBe(2); expect(Number(data.s.ratePerHour)).toBe(28); expect(Math.round(Number(data.s.totalAmount)*100)/100).toBe(14); expect(Math.round(Number(data.p.amount)*100)/100).toBe(14);
  expect(errors).toEqual([]);
  console.log('V230_OPERATOR_SPEED_OK');
});

test('Control Center surfaces next-best revenue actions and executes an extension in one click', async ({page}) => {
  const errors=await boot(page);
  await page.evaluate(() => {
    const st=stationById('ps5-1');
    const s={id:'qa-smart-session',stationId:st.id,resourceId:st.id,resourceType:'CONSOLE',status:'active',mode:'fixed',billingModel:'TIME_PRORATED',startAt:Date.now()-22*60000,endAt:Date.now()+8*60000,players:1,plannedMinutes:30,ratePerHour:22,pricingSnapshot:{billingModel:'TIME_PRORATED',hourlyRate:22,currency:'MAD'},baseAmount:11,totalAmount:11,discountAmount:0,customerId:null,gameTitle:'EA SPORTS FC',createdAt:Date.now()-22*60000,updatedAt:Date.now(),revision:0};
    state.sessions=state.sessions.filter(x=>x.id!=='qa-smart-session'&&x.stationId!=='ps5-1'); state.sessions.push(s); saveState(); window.LPClient.go('csHome');
  });
  await expect(page.locator('.ops-live-strip')).toContainText('OPPORTUNITÉS');
  const row=page.locator('.ops-conversion-card [data-ops-convert="extend"]').first(); await expect(row).toBeVisible();
  await expect(row).toContainText('+30 min');
  const before=await page.evaluate(()=>({total:Number(state.sessions.find(x=>x.id==='qa-smart-session')?.totalAmount||0),assisted:Number(state.operatorMetrics?.assistedRevenue||0),accepted:Number(state.operatorMetrics?.acceptedActions||0)}));
  await row.click();
  await expect.poll(()=>currentRoute(page)).toBe('csHome');
  await expect(page.locator('#overlay')).not.toHaveClass(/show/);
  const data=await page.evaluate(()=>({s:state.sessions.find(x=>x.id==='qa-smart-session'),metrics:state.operatorMetrics||{}}));
  expect(Math.round(Number(data.s.plannedMinutes))).toBe(60); expect(Number(data.s.totalAmount)).toBeGreaterThan(before.total);
  const incremental=Number(data.s.totalAmount)-before.total;
  expect(Number(data.metrics.assistedRevenue||0)-before.assisted).toBeCloseTo(incremental,5);
  expect(Number(data.metrics.acceptedActions||0)-before.accepted).toBe(1);
  await expect(page.locator('.ops-live-assisted')).toContainText('CA ASSISTÉ');
  await expect(page.locator('.ops-live-assisted')).toContainText(String(Number(data.metrics.acceptedActions||0)));
  expect(errors).toEqual([]);
  console.log('V230_ASSISTED_REVENUE_OK');
  console.log('V230_MARKETING_CONVERSION_OK');
});

test('all eight resource types have contextual billing profiles and media/settings stay responsive', async ({page}) => {
  const errors=await boot(page);
  const profiles=await page.evaluate(()=>Object.entries(window.LPClient.opsProfiles||{}).map(([type,p])=>({type,model:p.defaultModel,game:p.game})));
  expect(profiles).toHaveLength(8);
  expect(profiles.find(x=>x.type==='BILLIARD_TABLE').model).toBe('PER_GAME');
  expect(profiles.find(x=>x.type==='SNOOKER_TABLE').model).toBe('PER_GAME');
  expect(profiles.find(x=>x.type==='PRIVATE_ROOM').model).toBe('TIME_BLOCK');
  expect(profiles.find(x=>x.type==='CONSOLE').model).toBe('TIME_PRORATED');
  await page.evaluate(()=>window.LPClient.go('settings'));
  await page.locator('[data-settings="media"]').click();
  await expect(page.locator('[data-ops-media-file]')).toHaveCount(8);
  const img=page.locator('.ops-media-preview img').first(); await expect(img).toBeVisible();
  expect(await img.evaluate(el=>getComputedStyle(el).objectFit)).toBe('cover');
  await page.setViewportSize({width:915,height:412}); await page.evaluate(()=>window.onLaPauseViewportChanged&&window.onLaPauseViewportChanged()); await page.waitForTimeout(120);
  expect(await img.evaluate(el=>getComputedStyle(el).objectFit)).toBe('cover');
  await page.evaluate(()=>{settingsSection=null;window.renderSettingsV230()});
  await page.locator('[data-settings="stations"]').click();
  const firstType=page.locator('[data-ops-station-type]').first(); await expect(firstType.locator('option')).toHaveCount(8);
  await page.evaluate(()=>{settingsSection=null;window.renderSettingsV230()});
  await page.locator('[data-settings="pricing"]').click();
  await expect(page.locator('[data-ops-price-type]')).toHaveCount(8);
  expect(errors).toEqual([]);
  console.log('V230_MEDIA_8_TYPES_OK');
  console.log('V230_ALL_RESOURCE_TYPES_CLICK_OK '+profiles.map(x=>x.type).join(','));
  console.log('V230_CLIENT_E2E_OK');
});
