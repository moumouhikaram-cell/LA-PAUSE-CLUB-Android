'use strict';
const { test, expect } = require('@playwright/test');
const URL=process.env.LP_E2E_URL||'http://127.0.0.1:4173/index.html';
test.setTimeout(120000);

async function boot(page,viewport={width:412,height:915}){
  await page.setViewportSize(viewport);
  await page.addInitScript(()=>{
    window.__lpExitRequests=0;
    window.ClientAndroid={requestExitConfirmation(){window.__lpExitRequests++},exitApp(){window.__lpExitRequests++},getSafeInsetsJson(){return JSON.stringify({left:0,top:24,right:0,bottom:24})},commitCoreCommand(commandJson,nextStateJson,eventJson){try{return JSON.stringify({ok:true,state:JSON.parse(nextStateJson||'{}'),event:JSON.parse(eventJson||'{}')})}catch(e){return JSON.stringify({ok:false,message:String(e)})}},scheduleSessionAlarm(){return true},cancelSessionAlarm(){return true},keepScreenOn(){return true},showTestNotification(){return true},setStateJson(){return true}};
    window.Android=window.ClientAndroid;
  });
  const errors=[];page.on('pageerror',e=>errors.push(String(e.stack||e.message)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.body.classList.contains('nx-shell-ready')&&window.LPClient?.views?.nxSettings);
  return errors;
}
const route=page=>page.evaluate(()=>LPClient.canonical(LPClient.lastRendered));
async function home(page){await page.evaluate(()=>LPClient.go('csHome'));await expect.poll(()=>route(page)).toBe('csHome')}
async function assertNextShell(page){
  await expect(page.locator('#nxTop')).toHaveCount(1);await expect(page.locator('#nxTop')).toBeVisible();
  await expect(page.locator('#nxDock')).toHaveCount(1);await expect(page.locator('#nxDock')).toBeVisible();
  await expect(page.locator('#csTop,#csDock,#csRail,#csMenuPanel')).toHaveCount(0);
  await expect(page.locator('#legacyBridge')).toBeHidden();await expect(page.locator('#view')).not.toBeEmpty();
}

test('next shell is the only runtime chrome from first interactive frame',async({page})=>{
  const errors=await boot(page);await assertNextShell(page);await expect.poll(()=>route(page)).toBe('csHome');expect(errors).toEqual([]);console.log('V240_CORE_SINGLE_SHELL_OK');
});

test('all SaaS navigation menu routes open by real clicks without exposing old chrome',async({page})=>{
  const errors=await boot(page);await page.locator('#nxMore').click();
  const entries=await page.locator('#nxMenuSections [data-nx-menu-route]').evaluateAll(es=>es.map(e=>({route:e.dataset.nxMenuRoute,label:(e.innerText||'').trim()})));
  expect(entries.length).toBeGreaterThanOrEqual(20);
  const failures=[];
  for(const item of entries){
    try{
      await home(page);await page.locator('#nxMore').click();await expect(page.locator('#nxMenuLayer')).toHaveClass(/show/);
      const target=page.locator(`#nxMenuSections [data-nx-menu-route="${item.route}"]`).first();await expect(target).toBeVisible();await target.click();
      await expect.poll(()=>route(page)).toBe(item.route);await expect(page.locator('#view')).not.toBeEmpty();await assertNextShell(page);
    }catch(e){failures.push(`${item.route} ${item.label}: ${e.message}`)}
  }
  expect(failures,failures.join('\n')).toEqual([]);expect(errors).toEqual([]);console.log(`V240_ALL_SAAS_ROUTES_CLICK_OK ${entries.length}`);
});

test('back, menu overlay and Home exit remain deterministic in the new shell',async({page})=>{
  const errors=await boot(page);
  await page.locator('#nxDock [data-nx-route="csStations"]').click();await expect.poll(()=>route(page)).toBe('csStations');
  await page.evaluate(()=>LPClient.go('nxSettings'));await expect.poll(()=>route(page)).toBe('nxSettings');
  await page.evaluate(()=>LPClient.back(false));await expect.poll(()=>route(page)).toBe('csStations');
  await page.locator('#nxMore').click();await expect(page.locator('#nxMenuLayer')).toHaveClass(/show/);await page.evaluate(()=>LPClient.back(false));await expect(page.locator('#nxMenuLayer')).not.toHaveClass(/show/);await expect.poll(()=>route(page)).toBe('csStations');
  await home(page);await page.evaluate(()=>nativeBack());await expect.poll(()=>page.evaluate(()=>window.__lpExitRequests)).toBe(1);await expect.poll(()=>route(page)).toBe('csHome');
  expect(errors).toEqual([]);console.log('V240_CORE_BACK_STACK_OK');
});

test('rotation preserves SaaS route and never recreates legacy navigation',async({page})=>{
  const errors=await boot(page);await page.evaluate(()=>LPClient.go('nxModules'));await expect.poll(()=>route(page)).toBe('nxModules');
  await page.evaluate(()=>scrollTo(0,Math.min(350,Math.max(0,document.documentElement.scrollHeight-innerHeight))));const before=await page.evaluate(()=>scrollY);
  await page.setViewportSize({width:915,height:412});await page.evaluate(()=>window.onLaPauseViewportChanged?.());await page.waitForTimeout(220);await expect.poll(()=>route(page)).toBe('nxModules');await assertNextShell(page);
  await page.setViewportSize({width:412,height:915});await page.evaluate(()=>window.onLaPauseViewportChanged?.());await page.waitForTimeout(220);await expect.poll(()=>route(page)).toBe('nxModules');await assertNextShell(page);
  const after=await page.evaluate(()=>scrollY);expect(Math.abs(after-before)).toBeLessThanOrEqual(24);expect(errors).toEqual([]);console.log('V240_CORE_ROTATION_OK');
});

test('representative operator path keeps métier-first session surface and cash/history reachable',async({page})=>{
  const errors=await boot(page);
  await page.evaluate(()=>{state.ui=state.ui||{};state.ui.opsActivityType='CONSOLE';LPClient.go('csHome')});
  await expect(page.locator('[data-ux-activity="CONSOLE"]')).toHaveClass(/active/);
  const card=page.locator('[data-cs-station]').first();await expect(card).toBeVisible();const start=card.locator('[data-cs-start]').first();if(await start.count()){await start.click();await expect(page.locator('#opsSessionForm')).toBeVisible();await expect(page.locator('#opsClient')).toHaveCount(0);await expect(page.getByText('Non identifié',{exact:true}).first()).toBeVisible();await page.evaluate(()=>closeSheet?.())}
  await page.evaluate(()=>LPClient.go('cash'));await expect.poll(()=>route(page)).toBe('cash');await expect(page.locator('#view')).not.toBeEmpty();
  await page.evaluate(()=>LPClient.go('history'));await expect.poll(()=>route(page)).toBe('history');await expect(page.locator('#view')).not.toBeEmpty();expect(errors).toEqual([]);console.log('V240_CORE_OPERATOR_FLOW_OK');
});

test('core next-shell E2E contract complete',async({page})=>{await boot(page);console.log('V240_CORE_E2E_OK')});
