'use strict';
const { test, expect } = require('@playwright/test');

const APP_URL = process.env.LP_E2E_URL || 'http://127.0.0.1:4173/index.html';
const CONTROL_SELECTOR = '#view button:not([disabled]):visible,#view a[href]:visible,#view input[type="button"]:not([disabled]):visible,#view input[type="submit"]:not([disabled]):visible,#view input[type="checkbox"]:not([disabled]):visible,#view input[type="radio"]:not([disabled]):visible,#view select:not([disabled]):visible,#view summary:visible';
test.setTimeout(600000);

async function boot(page){
  await page.setViewportSize({width:412,height:915});
  await page.addInitScript(()=>{
    window.__qaSaved=[];
    window.ClientAndroid={requestExitConfirmation(){},exitApp(){},getSafeInsetsJson(){return JSON.stringify({left:0,top:24,right:0,bottom:24});}};
    window.Android={
      commitCoreCommand(commandJson,nextStateJson,eventJson){try{return JSON.stringify({ok:true,state:JSON.parse(nextStateJson||'{}'),event:JSON.parse(eventJson||'{}'),commandId:JSON.parse(commandJson||'{}').commandId||null});}catch(e){return JSON.stringify({ok:false,message:String(e.message||e)});}},
      scheduleSessionAlarm(){return true;},cancelSessionAlarm(){return true;},keepScreenOn(){return true;},showTestNotification(){return true;},setStateJson(){return true;},getStateJson(){return '';},
      saveText(name,mime,text){window.__qaSaved.push({name,mime,size:String(text||'').length});return true;},getSecureValue(){return '';},setSecureValue(){return true;},deleteSecureValue(){return true;},getDeviceInfo(){return '{}';},httpRequest(){return JSON.stringify({status:200,body:{}});}
    };
    window.open=()=>null;
  });
  const runtime=[];
  page.on('pageerror',e=>runtime.push(`pageerror: ${e.stack||e.message}`));
  page.on('console',m=>{if(m.type()==='error')runtime.push(`console: ${m.text()}`);});
  page.on('dialog',async d=>{try{await d.dismiss();}catch(_){}});
  page.on('filechooser',async f=>{try{await f.setFiles([]);}catch(_){}});
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.LPClient&&document.body.classList.contains('nx-shell-ready'));
  return runtime;
}
async function captureStorage(page){return page.evaluate(()=>{const out={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);out[k]=localStorage.getItem(k);}return out;});}
async function resetToBaseline(page,baseline){
  await page.evaluate(store=>{localStorage.clear();for(const [k,v] of Object.entries(store))localStorage.setItem(k,v);},baseline);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.LPClient&&document.body.classList.contains('nx-shell-ready'));
}
async function go(page,route){
  await page.evaluate(r=>{try{window.closeOverlay&&window.closeOverlay();}catch(_){}try{window.closeModal&&window.closeModal();}catch(_){}window.LPClient.go(r);},route);
  await expect.poll(()=>page.evaluate(()=>window.LPClient.canonical(window.LPClient.lastRendered))).toBe(route);
  await expect(page.locator('#view')).not.toBeEmpty();
}
async function controls(page){return page.locator(CONTROL_SELECTOR).evaluateAll(els=>els.map((el,i)=>({i,tag:el.tagName,type:el.getAttribute('type')||'',id:el.id||'',text:(el.innerText||el.getAttribute('aria-label')||el.getAttribute('title')||el.value||'').trim().replace(/\s+/g,' ').slice(0,120),name:el.getAttribute('name')||'',data:Array.from(el.attributes).filter(a=>a.name.startsWith('data-')).slice(0,4).map(a=>`${a.name}=${a.value}`).join('|')})));}
async function activate(page,index){
  const loc=page.locator(CONTROL_SELECTOR).nth(index); const tag=await loc.evaluate(el=>el.tagName);
  if(tag==='SELECT'){
    const vals=await loc.locator('option').evaluateAll(os=>os.filter(o=>!o.disabled).map(o=>o.value));
    if(vals.length>1){const current=await loc.inputValue();await loc.selectOption(vals.find(v=>v!==current)??vals[0]);}else await loc.dispatchEvent('change');
  }else await loc.click({timeout:3000});
}
async function assertHealthySurface(page){
  await expect(page.locator('#nxTop')).toHaveCount(1);
  await expect(page.locator('#nxDock')).toHaveCount(1);
  await expect(page.locator('#csTop,#csDock,#csRail,#csMenuPanel')).toHaveCount(0);
  const ok=await page.evaluate(()=>{const view=(document.querySelector('#view')?.innerText||'').trim();const overlay=document.querySelector('#overlay')?.classList.contains('show');const modal=document.querySelector('#modalBackdrop')?.classList.contains('show');return view.length>0||overlay||modal;});
  if(!ok) throw new Error('blank SaaS surface after click');
}
async function discoverRoutes(page){
  await page.locator('#nxMenuOpen').click();
  await expect(page.locator('#nxMenuLayer')).toHaveClass(/show/);
  const menu=await page.locator('#nxMenuSections [data-nx-menu-route]').evaluateAll(els=>els.map(e=>e.dataset.nxMenuRoute).filter(Boolean));
  const dock=await page.locator('#nxDock [data-nx-route]').evaluateAll(els=>els.map(e=>e.dataset.nxRoute).filter(Boolean));
  await page.locator('[data-nx-close]').first().click();
  return Array.from(new Set([...dock,...menu]));
}

test('all visible controls on every SaaS route survive isolated customer clicks',async({page})=>{
  const runtime=await boot(page); const baseline=await captureStorage(page); const routes=await discoverRoutes(page); const failures=[]; const coverage=[];
  expect(routes.length).toBeGreaterThanOrEqual(15);
  for(const route of routes){
    await resetToBaseline(page,baseline); await go(page,route); const list=await controls(page); coverage.push({route,total:list.length});
    for(let i=0;i<list.length;i++){
      const c=list[i],beforeErrors=runtime.length;
      try{
        await resetToBaseline(page,baseline); await go(page,route); const fresh=await controls(page); if(i>=fresh.length) throw new Error(`control missing from clean baseline at index ${i}`);
        await activate(page,i); await page.waitForTimeout(90); const newErrors=runtime.slice(beforeErrors); if(newErrors.length) throw new Error(newErrors.join(' | ')); await assertHealthySurface(page);
      }catch(e){failures.push(`${route} :: #${i} ${c.tag}/${c.type} ${c.id||c.text||c.data||c.name||'unnamed'} => ${e.message}`);}
    }
  }
  const total=coverage.reduce((n,r)=>n+r.total,0);
  console.log('V240_CLICK_MATRIX_COVERAGE '+JSON.stringify(coverage)); console.log(`V240_CLICK_MATRIX_TOTAL ${total}`);
  if(failures.length) console.error('V240_CLICK_MATRIX_FAILURES\n'+failures.join('\n'));
  expect(total).toBeGreaterThan(30); expect(failures,failures.join('\n')).toEqual([]); expect(runtime).toEqual([]);
  console.log('V240_CLICK_MATRIX_OK');
  console.log('V230_CLICK_MATRIX_OK');
});

test('every Settings hub action survives a real isolated click',async({page})=>{
  const runtime=await boot(page); const baseline=await captureStorage(page); await go(page,'nxSettings');
  const actions=await page.locator('#view [data-nx-route]').evaluateAll(els=>els.map(e=>({route:e.dataset.nxRoute,label:(e.innerText||'').trim().replace(/\s+/g,' ').slice(0,100)})));
  expect(actions.length).toBeGreaterThanOrEqual(10);
  const failures=[];
  for(const a of actions){
    const beforeErrors=runtime.length;
    try{
      await resetToBaseline(page,baseline); await go(page,'nxSettings'); const b=page.locator(`#view [data-nx-route="${a.route}"]`).first(); await expect(b).toBeVisible(); await b.click();
      await page.waitForTimeout(100); const newErrors=runtime.slice(beforeErrors); if(newErrors.length) throw new Error(newErrors.join(' | ')); await assertHealthySurface(page);
    }catch(e){failures.push(`settings -> ${a.route} (${a.label}): ${e.message}`);}
  }
  if(failures.length) console.error('V240_SETTINGS_ACTION_FAILURES\n'+failures.join('\n'));
  expect(failures,failures.join('\n')).toEqual([]); expect(runtime).toEqual([]);
  console.log(`V240_SETTINGS_ACTIONS_OK ${actions.length}`);
});
