'use strict';
const { test, expect } = require('@playwright/test');

const APP_URL = process.env.LP_E2E_URL || 'http://127.0.0.1:4173/index.html';
const forbiddenClientText = [/Master\s*V2/i,/\bSQLite\b/i,/\bCDC\b/i,/\bdebug\b/i,/\bP[1-5]\s*(phase|runtime|module)\b/i];

async function boot(page, viewport={width:412,height:915}) {
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    window.__lpExitRequests = 0;
    window.ClientAndroid = {
      requestExitConfirmation(){ window.__lpExitRequests += 1; },
      exitApp(){ window.__lpExitRequests += 1; },
      getSafeInsetsJson(){ return JSON.stringify({left:0,top:24,right:0,bottom:24}); }
    };
  });
  const errors=[];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
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

test('boot has a single customer shell and no client-visible developer language', async ({page}) => {
  const errors=await boot(page);
  await assertChrome(page);
  await expect.poll(()=>currentRoute(page)).toBe('csHome');
  expect(await clientTextViolations(page)).toEqual([]);
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

  // Old/domain routes may still assign currentView and call renderView directly. The product shell must capture them.
  await page.evaluate(() => { window.LPClient.go('csStations'); });
  await expect.poll(()=>currentRoute(page)).toBe('csStations');
  await page.evaluate(() => { window.setView('clients'); });
  await expect.poll(()=>currentRoute(page)).toBe('clients');
  await page.locator('#csBack').click();
  await expect.poll(()=>currentRoute(page)).toBe('csStations');

  // A sheet/modal/menu gets first refusal: Back closes it without changing route.
  const start=page.locator('[data-cs-start]').first();
  await expect(start).toBeVisible();
  await start.click();
  await expect(page.locator('#overlay')).toHaveClass(/show/);
  await page.evaluate(() => window.nativeBack());
  await expect(page.locator('#overlay')).not.toHaveClass(/show/);
  await expect.poll(()=>currentRoute(page)).toBe('csStations');

  // Explicit Home is a navigation root. Back may never reopen stale history.
  await page.locator('#csDock [data-cs-go="csHome"]').click();
  await expect.poll(()=>currentRoute(page)).toBe('csHome');
  await expect(page.locator('#csBack')).toHaveClass(/hidden/);
  await page.evaluate(() => window.nativeBack());
  await expect.poll(()=>page.evaluate(()=>window.__lpExitRequests)).toBe(1);
  await expect.poll(()=>currentRoute(page)).toBe('csHome');
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
  await expect(page.locator('#payNow')).toBeChecked();
  const duration30=page.locator('[data-duration="30"]');
  if(await duration30.count()) await duration30.click();
  const duo=page.locator('[data-players="2"]');
  if(await duo.count()) await duo.click();
  await page.locator('#startSessionBtn').click();
  await expect(page.locator('#overlay')).not.toHaveClass(/show/);
  const state1=await page.evaluate(() => ({
    active:state.sessions.filter(s=>s.status==='active').length,
    payments:state.payments.length,
    shifts:state.shifts.filter(s=>s.status==='open').map(s=>({id:s.id,openingCash:s.openingCash,autoOpened:s.autoOpened})),
    paymentShift:state.payments.at(-1)?.shiftId||null,
    toasts:document.querySelector('#toast')?.textContent||''
  }));
  expect(state1.active).toBe(1);
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
  await page.locator('[data-cs-manage]').first().click();
  await expect(page.locator('#finishBtn')).toBeVisible();
  const extend=page.locator('[data-extend="15"]').first();
  if(await extend.count()) await extend.click();
  await page.locator('#finishBtn').click();
  await expect(page.locator('#modalOk')).toBeVisible();
  await page.locator('#modalOk').click();
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
  const sim=await page.evaluate(()=>state.sessions.find(s=>s.stationId==='sim-1'&&s.status==='active'));
  expect(sim).toBeTruthy();
  expect(Number(sim.ratePerHour)).toBe(45);
  await simCard.locator('[data-cs-manage]').click();
  await expect(page.locator('#finishBtn')).toBeVisible();
  expect(errors).toEqual([]);
  console.log('V230_SIM_CLICK_FLOW_OK');
  console.log('V230_CLIENT_E2E_OK');
});
