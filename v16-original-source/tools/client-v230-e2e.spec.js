'use strict';
const { test, expect } = require('@playwright/test');

const APP_URL = process.env.LP_E2E_URL || 'http://127.0.0.1:4173/index.html';
const forbiddenClientText = [/Master\s*V2/i,/\bSQLite\b/i,/\bCDC\b/i,/\bP[1-5]\s*(phase|runtime|module)\b/i];
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
        }catch(e){ return JSON.stringify({ok:false,message:e.message||String(e)}); }
      },
      scheduleSessionAlarm(){ return true; }, cancelSessionAlarm(){ return true; }, keepScreenOn(){ return true; },
      showTestNotification(){ return true; }, setStateJson(){ return true; }, getStateJson(){ return ''; },
      getSecureValue(){ return ''; }, setSecureValue(){ return true; }, deleteSecureValue(){ return true; },
      getDeviceInfo(){ return '{}'; }, httpRequest(){ return JSON.stringify({status:200,body:{}}); }
    };
    window.Android=window.ClientAndroid;
  });
  const errors=[];
  page.on('pageerror',e=>errors.push(`pageerror: ${e.stack||e.message}`));
  page.on('console',m=>{ if(m.type()==='error') errors.push(`console: ${m.text()}`); });
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.LPClient && document.body.classList.contains('nx-shell-ready'));
  return errors;
}

async function currentRoute(page){ return page.evaluate(()=>window.LPClient.canonical(window.LPClient.lastRendered)); }
async function assertShell(page){
  await expect(page.locator('#nxTop')).toHaveCount(1);
  await expect(page.locator('#nxDock')).toHaveCount(1);
  await expect(page.locator('#nxTop')).toBeVisible();
  await expect(page.locator('#nxDock')).toBeVisible();
  await expect(page.locator('#csTop,#csDock,#csRail,#csMenuPanel')).toHaveCount(0);
  await expect(page.locator('#view')).not.toBeEmpty();
  if(await page.locator('#lpBootScreen').count()) await expect(page.locator('#lpBootScreen')).toBeHidden();
  if(await page.locator('#legacyBridge').count()) await expect(page.locator('#legacyBridge')).toBeHidden();
}
async function clickDock(page,route){
  const b=page.locator(`#nxDock [data-nx-route="${route}"]`);
  await expect(b).toBeVisible();
  await b.click();
  await expect.poll(()=>currentRoute(page)).toBe(route);
}
async function openMenuRoute(page,route){
  await page.locator('#nxMenuOpen').click();
  await expect(page.locator('#nxMenuLayer')).toHaveClass(/show/);
  const b=page.locator(`#nxMenuSections [data-nx-menu-route="${route}"]`).first();
  await expect(b).toBeVisible();
  await b.click();
  await expect.poll(()=>currentRoute(page)).toBe(route);
  await expect(page.locator('#nxMenuLayer')).not.toHaveClass(/show/);
}
async function clientTextViolations(page){
  const text=await page.locator('body').innerText();
  return forbiddenClientText.filter(r=>r.test(text)).map(String);
}

async function prepareConsoleSale(page){
  await page.evaluate(()=>{
    state.sessions=[]; state.payments=[]; state.shifts=[]; state.orders=[];
    state.sessionRules=state.sessionRules||{};
    state.sessionRules.defaultPaymentTiming='start';
    state.sessionRules.allowOpenSession=true;
    state.ui=state.ui||{}; state.ui.opsActivityType='CONSOLE';
    saveState(); window.LPClient.go('csHome');
  });
  await expect.poll(()=>currentRoute(page)).toBe('csHome');
  await expect(page.locator('[data-ux-activity="CONSOLE"]')).toHaveClass(/active/);
}

test('first frame is the SaaS shell with zero legacy chrome',async({page})=>{
  const errors=await boot(page);
  await assertShell(page);
  await expect.poll(()=>currentRoute(page)).toBe('csHome');
  expect(await clientTextViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
  console.log('V240_CORE_FIRST_FRAME_OK');
});

test('every SaaS menu destination opens by real click and returns through the new dock',async({page})=>{
  const errors=await boot(page);
  await page.locator('#nxMenuOpen').click();
  await expect(page.locator('#nxMenuLayer')).toHaveClass(/show/);
  const routes=await page.locator('#nxMenuSections [data-nx-menu-route]').evaluateAll(els=>Array.from(new Set(els.map(e=>e.dataset.nxMenuRoute).filter(Boolean))));
  await page.locator('.nx-menu-close').click();
  await expect(page.locator('#nxMenuLayer')).not.toHaveClass(/show/);
  expect(routes.length).toBeGreaterThanOrEqual(15);
  const failures=[];
  for(const route of routes){
    try{
      await clickDock(page,'csHome');
      await openMenuRoute(page,route);
      await assertShell(page);
      const text=(await page.locator('#view').innerText()).trim();
      if(text.length<3) throw new Error('surface vide');
      const dev=await clientTextViolations(page); if(dev.length) throw new Error(`texte développeur visible: ${dev.join(', ')}`);
    }catch(e){ failures.push(`${route}: ${e.message}`); }
  }
  if(failures.length) console.error('V240_CORE_ROUTE_FAILURES\n'+failures.join('\n'));
  expect(failures,failures.join('\n')).toEqual([]);
  expect(errors).toEqual([]);
  console.log(`V240_CORE_MENU_ROUTES_OK ${routes.length}`);
});

test('native back closes transient session UI, walks SaaS history and exits only from Home',async({page})=>{
  const errors=await boot(page);
  await clickDock(page,'csStations');
  const start=page.locator('[data-cs-start]:visible').first();
  await expect(start).toBeVisible();
  await start.click();
  await expect(page.locator('#overlay')).toHaveClass(/show/);
  await page.evaluate(()=>window.nativeBack());
  await expect(page.locator('#overlay')).not.toHaveClass(/show/);
  await expect.poll(()=>currentRoute(page)).toBe('csStations');

  await clickDock(page,'clients');
  await page.evaluate(()=>window.nativeBack());
  await expect.poll(()=>currentRoute(page)).toBe('csStations');
  await page.evaluate(()=>window.nativeBack());
  await expect.poll(()=>currentRoute(page)).toBe('csHome');
  await page.evaluate(()=>window.nativeBack());
  await expect.poll(()=>page.evaluate(()=>window.__lpExitRequests)).toBe(1);
  expect(errors).toEqual([]);
  console.log('V240_CORE_NATIVE_BACK_OK');
});

test('rotation preserves route, draft value, scroll and one SaaS shell',async({page})=>{
  const errors=await boot(page);
  await page.evaluate(()=>window.LPClient.go('csSetup'));
  await expect.poll(()=>currentRoute(page)).toBe('csSetup');
  const editable=page.locator('#view input:not([type="file"]):not([type="hidden"]):visible,#view textarea:visible,#view select:visible').first();
  await expect(editable).toBeVisible();
  const tag=await editable.evaluate(el=>el.tagName);
  let expected='';
  if(tag==='SELECT'){
    const vals=await editable.locator('option').evaluateAll(os=>os.filter(o=>!o.disabled).map(o=>o.value).filter(Boolean));
    expected=vals[Math.min(1,Math.max(0,vals.length-1))]||await editable.inputValue();
    if(expected) await editable.selectOption(expected);
  }else{
    const type=await editable.getAttribute('type'); expected=type==='number'?'123':'QA-SAAS-ROTATION'; await editable.fill(expected);
  }
  await page.evaluate(()=>scrollTo(0,Math.min(420,Math.max(0,document.documentElement.scrollHeight-innerHeight))));
  const before=await page.evaluate(()=>({route:window.LPClient.canonical(window.LPClient.lastRendered),y:scrollY}));
  await page.setViewportSize({width:915,height:412});
  await page.evaluate(()=>window.onLaPauseViewportChanged&&window.onLaPauseViewportChanged());
  await page.waitForTimeout(180);
  expect(await currentRoute(page)).toBe(before.route);
  await assertShell(page);
  expect(await editable.inputValue()).toBe(expected);
  await page.setViewportSize({width:412,height:915});
  await page.evaluate(()=>window.onLaPauseViewportChanged&&window.onLaPauseViewportChanged());
  await page.waitForTimeout(180);
  expect(await currentRoute(page)).toBe(before.route);
  expect(await editable.inputValue()).toBe(expected);
  expect(Math.abs((await page.evaluate(()=>scrollY))-before.y)).toBeLessThanOrEqual(24);
  expect(errors).toEqual([]);
  console.log('V240_CORE_ROTATION_OK');
});

test('console sale creates one paid session and an auto-opened shift across dashboard, cash and history',async({page})=>{
  const errors=await boot(page);
  await prepareConsoleSale(page);
  const card=page.locator('[data-cs-station="ps5-1"]');
  await expect(card).toBeVisible();
  const quick=card.locator('[data-ops-quick-id="ps5-1"]');
  if(await quick.count() && await quick.isVisible()) await quick.click(); else await card.locator('[data-cs-start]').first().click();
  await expect(page.locator('#opsSessionForm')).toBeVisible();
  const duration30=page.locator('[data-ops-duration="30"]'); if(await duration30.count()) await duration30.click();
  const duo=page.locator('[data-ops-players="2"]'); if(await duo.count()) await duo.click();
  await expect(page.locator('#startSessionBtn')).toBeVisible();
  await page.locator('#startSessionBtn').click();
  await expect(page.locator('#overlay')).not.toHaveClass(/show/);
  const data=await page.evaluate(()=>({
    active:state.sessions.find(s=>s.status==='active'&&(s.stationId==='ps5-1'||s.resourceId==='ps5-1'))||null,
    payments:(state.payments||[]).length,
    openShifts:(state.shifts||[]).filter(s=>s.status==='open'),
    payment:(state.payments||[]).at(-1)||null
  }));
  expect(data.active).toBeTruthy();
  expect(data.payments).toBe(1);
  expect(data.openShifts).toHaveLength(1);
  expect(data.openShifts[0].autoOpened).toBe(true);
  expect(data.payment.shiftId).toBe(data.openShifts[0].id);
  await clickDock(page,'cash'); await expect(page.locator('#view')).not.toBeEmpty();
  await page.evaluate(()=>window.LPClient.go('history')); await expect.poll(()=>currentRoute(page)).toBe('history'); await expect(page.locator('#view')).not.toBeEmpty();
  expect(errors).toEqual([]);
  console.log('V240_CORE_SALE_CASH_HISTORY_OK');
});

test('resource and pricing setup remains universal across all nine supported resource types',async({page})=>{
  const errors=await boot(page);
  const profiles=await page.evaluate(()=>Object.entries(window.LPClient.opsProfiles||{}).map(([type,p])=>({type,model:p.defaultModel})));
  expect(profiles).toHaveLength(9);
  expect(profiles.find(x=>x.type==='BILLIARD_TABLE').model).toBe('PER_GAME');
  expect(profiles.find(x=>x.type==='SNOOKER_TABLE').model).toBe('PER_GAME');
  expect(profiles.find(x=>x.type==='CONSOLE').model).toBe('TIME_PRORATED');
  expect(profiles.find(x=>x.type==='ARCADE').model).toBe('PER_GAME');
  await page.evaluate(()=>window.LPClient.go('csSetup'));
  await expect.poll(()=>currentRoute(page)).toBe('csSetup');
  await expect(page.locator('#view')).not.toBeEmpty();
  const text=(await page.locator('#view').innerText()).toUpperCase();
  expect(text).not.toContain('PARAMÈTRES SESSIONS PS5');
  await assertShell(page);
  expect(errors).toEqual([]);
  console.log('V240_CORE_9_RESOURCE_TYPES_OK');
  console.log('V240_CORE_E2E_OK');
  console.log('V230_E2E_OK');
});
