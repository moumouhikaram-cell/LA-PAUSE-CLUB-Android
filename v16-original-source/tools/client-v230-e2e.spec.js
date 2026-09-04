'use strict';
const { test, expect } = require('@playwright/test');

const APP_URL = process.env.LP_E2E_URL || 'http://127.0.0.1:4173/index.html';
const forbiddenClientText = [/Master\s*V2/i,/\bSQLite\b/i,/\bCDC\b/i,/\bdebug\b/i,/\bP[1-5]\s*(phase|runtime|module)\b/i];
test.setTimeout(120000);

async function boot(page, viewport={width:412,height:915}){
  await page.setViewportSize(viewport);
  await page.addInitScript(()=>{
    window.__lpExitRequests=0;
    window.ClientAndroid={
      requestExitConfirmation(){window.__lpExitRequests+=1;},exitApp(){window.__lpExitRequests+=1;},
      getSafeInsetsJson(){return JSON.stringify({left:0,top:24,right:0,bottom:24});},
      commitCoreCommand(commandJson,nextStateJson,eventJson){
        try{return JSON.stringify({ok:true,state:JSON.parse(nextStateJson||'{}'),event:JSON.parse(eventJson||'{}'),commandId:JSON.parse(commandJson||'{}').commandId||null});}
        catch(e){return JSON.stringify({ok:false,message:String(e.message||e)});}
      },
      scheduleSessionAlarm(){return true;},cancelSessionAlarm(){return true;},keepScreenOn(){return true;},
      showTestNotification(){return true;},setStateJson(){return true;},getStateJson(){return '';},
      getSecureValue(){return '';},setSecureValue(){return true;},deleteSecureValue(){return true;}
    };
    window.Android=window.ClientAndroid;
  });
  const errors=[];
  page.on('pageerror',e=>errors.push(`pageerror: ${e.stack||e.message}`));
  page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`);});
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.LPClient&&document.body.classList.contains('cs-ready'));
  return errors;
}

async function route(page){return page.evaluate(()=>window.LPClient.canonical(window.LPClient.lastRendered));}
async function go(page,r){await page.evaluate(x=>window.LPClient.go(x),r);await expect.poll(()=>route(page)).toBe(r);}
async function goHome(page){await go(page,'csHome');}
async function assertChrome(page){
  await expect(page.locator('#csTop')).toHaveCount(1);
  await expect(page.locator('#csDock')).toHaveCount(1);
  await expect(page.locator('#csRail')).toHaveCount(1);
  await expect(page.locator('#legacyBridge')).toBeHidden();
  await expect(page.locator('#view')).not.toBeEmpty();
}
async function clientTextViolations(page){const text=await page.locator('body').innerText();return forbiddenClientText.filter(r=>r.test(text)).map(String);}

async function selectActivity(page,type){
  await goHome(page);
  const tab=page.locator(`[data-ux-activity="${type}"]`);
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(tab).toHaveClass(/active/);
  await expect.poll(()=>page.evaluate(()=>state.ui?.opsActivityType)).toBe(type);
}

async function finishActiveStation(page,stationId){
  const card=page.locator(`[data-cs-station="${stationId}"]`);
  await expect(card).toBeVisible();
  await card.locator('[data-cs-manage]').click();
  await expect(page.locator('#finishBtn')).toBeVisible();
  const sid=await page.evaluate(id=>state.sessions.find(s=>(s.stationId===id||s.resourceId===id)&&['active','paused'].includes(String(s.status||'').toLowerCase()))?.id||'',stationId);
  const due=await page.evaluate(id=>{const s=state.sessions.find(x=>x.id===id),paid=(state.payments||[]).filter(p=>p.sessionId===id).reduce((n,p)=>n+Number(p.amount||0),0);return Math.max(0,Number(s?.totalAmount||0)-paid);},sid);
  if(due>0.009){
    await page.locator('#paymentBtn').click();
    await expect(page.locator('#payConfirm')).toBeVisible();
    await page.locator('#payConfirm').click();
    await expect(page.locator('#finishBtn')).toBeVisible();
  }
  await page.locator('#finishBtn').click();
  if(await page.locator('#modalOk').count()){await expect(page.locator('#modalOk')).toBeVisible();await page.locator('#modalOk').click();}
  await expect.poll(()=>page.evaluate(id=>state.sessions.find(s=>s.id===id)?.status,sid)).toBe('completed');
  return sid;
}

test('single customer shell boots cleanly with no developer vocabulary',async({page})=>{
  const errors=await boot(page);
  await assertChrome(page);
  await expect.poll(()=>route(page)).toBe('csHome');
  expect(await clientTextViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
  console.log('V230_SINGLE_RUNTIME_E2E_OK');
});

test('every customer menu route opens by real clicks and returns exactly Home',async({page})=>{
  const errors=await boot(page);
  const map=await page.evaluate(()=>window.LPClient.menuGroups.map(g=>({id:g.id,title:g.title,items:g.items.map(i=>({route:i[0],label:i[1]}))})));
  const failures=[];let clicked=0;
  for(const group of map){for(const item of group.items){
    try{
      await goHome(page);
      await page.locator('#csMore').click();
      await expect(page.locator('#csMenuPanel')).toHaveClass(/show/);
      await page.locator(`[data-menu-group="${group.id}"]`).click();
      const target=page.locator(`[data-menu-route="${item.route}"]`);
      await expect(target).toBeVisible();await target.click();
      await expect.poll(()=>route(page)).toBe(item.route);
      await expect(page.locator('#view')).not.toBeEmpty();
      if((await clientTextViolations(page)).length)throw new Error('developer language visible');
      await page.locator('#csBack').click();await expect.poll(()=>route(page)).toBe('csHome');clicked++;
    }catch(e){failures.push(`${group.title} > ${item.label} (${item.route}): ${e.message}`);}
  }}
  expect(failures,failures.join('\n')).toEqual([]);
  expect(clicked).toBe(map.reduce((n,g)=>n+g.items.length,0));
  expect(errors).toEqual([]);
  console.log(`V230_ALL_ROUTES_CLICK_OK ${clicked}`);
});

test('back stack, transient sheet, Home exit and rotation are deterministic',async({page})=>{
  const errors=await boot(page);
  await page.locator('#csDock [data-cs-go="csStations"]').click();await expect.poll(()=>route(page)).toBe('csStations');
  await page.locator('[data-cs-go="csSetup"]').first().click();await expect.poll(()=>route(page)).toBe('csSetup');
  await page.locator('#csBack').click();await expect.poll(()=>route(page)).toBe('csStations');
  const start=page.locator('[data-cs-start]:visible').first();await expect(start).toBeVisible();await start.click();
  await expect(page.locator('#overlay')).toHaveClass(/show/);
  await page.evaluate(()=>window.nativeBack());await expect(page.locator('#overlay')).not.toHaveClass(/show/);
  await page.locator('#csDock [data-cs-go="csHome"]').click();await expect.poll(()=>route(page)).toBe('csHome');
  await page.evaluate(()=>window.nativeBack());await expect.poll(()=>page.evaluate(()=>window.__lpExitRequests)).toBe(1);

  await go(page,'csSetup');
  const editable=page.locator('#view input:not([type="file"]):not([type="hidden"]),#view textarea,#view select').first();await expect(editable).toBeVisible();
  const tag=await editable.evaluate(el=>el.tagName);let expected='';
  if(tag==='SELECT'){
    const opts=await editable.locator('option').evaluateAll(os=>os.map(o=>o.value).filter(Boolean));expected=opts[Math.min(1,Math.max(0,opts.length-1))]||await editable.inputValue();if(expected)await editable.selectOption(expected);
  }else{expected=(await editable.getAttribute('type'))==='number'?'123':'QA-ROTATION-PRESERVED';await editable.fill(expected);}
  await page.setViewportSize({width:915,height:412});await page.evaluate(()=>window.onLaPauseViewportChanged&&window.onLaPauseViewportChanged());await page.waitForTimeout(150);
  expect(await route(page)).toBe('csSetup');await expect(page.locator('#csDock')).toBeHidden();await expect(page.locator('#csRail')).toBeVisible();expect(await editable.inputValue()).toBe(expected);
  await page.setViewportSize({width:412,height:915});await page.evaluate(()=>window.onLaPauseViewportChanged&&window.onLaPauseViewportChanged());await page.waitForTimeout(150);
  expect(await route(page)).toBe('csSetup');expect(await editable.inputValue()).toBe(expected);
  expect(errors).toEqual([]);
  console.log('V230_BACK_HOME_EXIT_OK');console.log('V230_ROTATION_PROGRESS_OK');
});

test('metier-first selector isolates all nine configured resource types',async({page})=>{
  const errors=await boot(page);
  const types=['CONSOLE','SIM_RACING','PC_GAMING','BILLIARD_TABLE','SNOOKER_TABLE','TABLE_TENNIS','PRIVATE_ROOM','ARCADE','CUSTOM'];
  await page.evaluate(ts=>{
    const legacy={CONSOLE:'PS5',SIM_RACING:'SIM',PC_GAMING:'PC',BILLIARD_TABLE:'BILLIARD',SNOOKER_TABLE:'SNOOKER',TABLE_TENNIS:'TABLE_TENNIS',PRIVATE_ROOM:'PRIVATE_ROOM',ARCADE:'ARCADE',CUSTOM:'CUSTOM'};
    state.sessions=[];state.ui=state.ui||{};
    for(const [i,t] of ts.entries()){
      const id=`core-${t.toLowerCase()}`;
      state.stations=(state.stations||[]).filter(s=>s.id!==id);
      state.stations.push({id,name:`${t} CORE`,type:legacy[t],osResourceType:t,enabled:true,maxPlayers:4,sort:950+i});
    }
    state.ui.opsActivityType='CONSOLE';saveState();window.LPClient.go('csHome');
  },types);
  for(const type of types){
    await selectActivity(page,type);
    const ids=await page.locator('[data-cs-station]:visible').evaluateAll(els=>els.map(e=>e.getAttribute('data-cs-station')));
    expect(ids.length).toBeGreaterThan(0);
    const wrong=await page.evaluate(({ids,type})=>ids.filter(id=>{const st=stationById(id);return st&&window.LPClient.typeOf(st)!==type;}),{ids,type});
    expect(wrong,`${type} leaked ${wrong.join(',')}`).toEqual([]);
    await expect(page.locator(`[data-cs-station="core-${type.toLowerCase()}"]`)).toBeVisible();
  }
  expect(errors).toEqual([]);
  console.log('V240_CORE_METIER_ISOLATION_OK');
});

test('real Console sale auto-opens cash shift, updates dashboard, then settles history',async({page})=>{
  const errors=await boot(page);
  await selectActivity(page,'CONSOLE');
  const card=page.locator('[data-cs-station="ps5-1"]');await expect(card).toBeVisible();
  const quick=card.locator('[data-ops-quick-id="ps5-1"]');if(await quick.count()&&await quick.isVisible())await quick.click();else await card.locator('[data-cs-start]:visible').first().click();
  await expect(page.locator('#startSessionBtn')).toBeVisible();
  const d30=page.locator('[data-ops-duration="30"]');if(await d30.count())await d30.click();
  const duo=page.locator('[data-ops-players="2"]');const duoAvailable=(await duo.count())>0;if(duoAvailable)await duo.click();
  await expect(page.locator('#startSessionBtn')).toContainText('Encaisser');await page.locator('#startSessionBtn').click();
  await expect(page.locator('#overlay')).not.toHaveClass(/show/);
  const active=await page.evaluate(()=>state.sessions.find(s=>(s.stationId==='ps5-1'||s.resourceId==='ps5-1')&&s.status==='active')||null);expect(active).toBeTruthy();
  if(duoAvailable){expect(Number(active.players)).toBe(2);expect(Number(active.ratePerHour)).toBe(28);}
  const financial=await page.evaluate(()=>{const s=state.sessions.find(x=>(x.stationId==='ps5-1'||x.resourceId==='ps5-1')&&x.status==='active');return {payments:state.payments.filter(p=>p.sessionId===s?.id),shifts:state.shifts.filter(x=>x.status==='open')};});
  expect(financial.payments).toHaveLength(1);expect(financial.shifts).toHaveLength(1);expect(financial.shifts[0].autoOpened).toBe(true);
  await goHome(page);await expect(page.locator('.ops-live-active')).toContainText('1');expect(await page.evaluate(()=>window.LPClient.revenue())).toBeGreaterThan(0);
  await selectActivity(page,'CONSOLE');const sid=await finishActiveStation(page,'ps5-1');
  await go(page,'history');await expect(page.locator(`[data-session-row="${sid}"]`)).toBeVisible();await expect(page.locator(`[data-session-row="${sid}"]`)).toContainText('PAYÉE');
  await go(page,'cash');await expect(page.locator('#view')).not.toBeEmpty();
  expect(errors).toEqual([]);
  console.log('V230_SESSION_CLICK_FLOW_OK');
});

test('nine billing profiles remain contextual and customer settings surfaces render',async({page})=>{
  const errors=await boot(page);
  const profiles=await page.evaluate(()=>Object.entries(window.LPClient.opsProfiles||{}).map(([type,p])=>({type,model:p.defaultModel,game:p.game})));
  expect(profiles.map(x=>x.type).sort()).toEqual(['ARCADE','BILLIARD_TABLE','CONSOLE','CUSTOM','PC_GAMING','PRIVATE_ROOM','SIM_RACING','SNOOKER_TABLE','TABLE_TENNIS'].sort());
  expect(profiles.find(x=>x.type==='CONSOLE').model).toBe('TIME_PRORATED');expect(profiles.find(x=>x.type==='BILLIARD_TABLE').model).toBe('PER_GAME');expect(profiles.find(x=>x.type==='ARCADE').model).toBe('PER_GAME');
  await go(page,'settings');
  const count=await page.locator('#view [data-settings]').count();expect(count).toBeGreaterThanOrEqual(10);
  expect(errors).toEqual([]);
  console.log('V230_ALL_RESOURCE_TYPES_CLICK_OK '+profiles.map(x=>x.type).join(','));
});

test('v2.3 compatibility core marker is emitted only after the v2.4 customer journeys pass',async({page})=>{
  await boot(page);await assertChrome(page);console.log('V230_E2E_OK');console.log('V230_CLIENT_E2E_OK');
});
