'use strict';
const { test, expect } = require('@playwright/test');

const APP_URL = process.env.LP_E2E_URL || 'http://127.0.0.1:4173/index.html';
const CONTROL_SELECTOR = '#view button:not([disabled]):visible,#view a[href]:visible,#view input[type="button"]:not([disabled]):visible,#view input[type="submit"]:not([disabled]):visible,#view input[type="checkbox"]:not([disabled]):visible,#view input[type="radio"]:not([disabled]):visible,#view select:not([disabled]):visible,#view summary:visible';
test.setTimeout(600000);

async function boot(page){
  await page.setViewportSize({width:412,height:915});
  await page.addInitScript(() => {
    window.__qaSaved=[];
    window.ClientAndroid={
      requestExitConfirmation(){}, exitApp(){},
      getSafeInsetsJson(){return JSON.stringify({left:0,top:24,right:0,bottom:24});}
    };
    window.Android={
      commitCoreCommand(commandJson,nextStateJson,eventJson){
        try{return JSON.stringify({ok:true,state:JSON.parse(nextStateJson||'{}'),event:JSON.parse(eventJson||'{}'),commandId:JSON.parse(commandJson||'{}').commandId||null});}
        catch(e){return JSON.stringify({ok:false,message:String(e.message||e)});}
      },
      scheduleSessionAlarm(){return true;}, cancelSessionAlarm(){return true;}, keepScreenOn(){return true;},
      showTestNotification(){return true;}, setStateJson(){return true;}, getStateJson(){return '';},
      saveText(name,mime,text){window.__qaSaved.push({name,mime,size:String(text||'').length});return true;},
      getSecureValue(){return '';}, setSecureValue(){return true;}, deleteSecureValue(){return true;},
      getDeviceInfo(){return '{}';}, httpRequest(){return JSON.stringify({status:200,body:{}});}
    };
    window.open=()=>null;
  });
  const runtime=[];
  page.on('pageerror',e=>runtime.push(`pageerror: ${e.stack||e.message}`));
  page.on('console',m=>{if(m.type()==='error')runtime.push(`console: ${m.text()}`);});
  page.on('dialog',async d=>{try{await d.dismiss();}catch(_){}});
  page.on('filechooser',async f=>{try{await f.setFiles([]);}catch(_){}});
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.LPClient&&document.body.classList.contains('cs-ready'));
  return runtime;
}

async function captureStorage(page){
  return page.evaluate(()=>{
    const out={};
    for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);out[k]=localStorage.getItem(k);}
    return out;
  });
}

async function resetToBaseline(page,baseline){
  await page.evaluate(store=>{
    localStorage.clear();
    for(const [k,v] of Object.entries(store))localStorage.setItem(k,v);
  },baseline);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.LPClient&&document.body.classList.contains('cs-ready'));
}

async function go(page,route){
  await page.evaluate(r=>{
    try{window.closeOverlay&&window.closeOverlay();}catch(_){}
    try{window.closeModal&&window.closeModal();}catch(_){}
    window.LPClient.go(r);
  },route);
  await expect.poll(()=>page.evaluate(()=>window.LPClient.canonical(window.LPClient.lastRendered))).toBe(route);
  await expect(page.locator('#view')).not.toBeEmpty();
}

async function controls(page){
  return page.locator(CONTROL_SELECTOR).evaluateAll((els)=>els.map((el,i)=>({
    i,
    tag:el.tagName,
    type:el.getAttribute('type')||'',
    id:el.id||'',
    text:(el.innerText||el.getAttribute('aria-label')||el.getAttribute('title')||el.value||'').trim().replace(/\s+/g,' ').slice(0,120),
    name:el.getAttribute('name')||'',
    data:Array.from(el.attributes).filter(a=>a.name.startsWith('data-')).slice(0,4).map(a=>`${a.name}=${a.value}`).join('|')
  })));
}

async function activate(page,index){
  const loc=page.locator(CONTROL_SELECTOR).nth(index);
  const tag=await loc.evaluate(el=>el.tagName);
  if(tag==='SELECT'){
    const vals=await loc.locator('option').evaluateAll(os=>os.filter(o=>!o.disabled).map(o=>o.value));
    if(vals.length>1){const current=await loc.inputValue();const next=vals.find(v=>v!==current)??vals[0];await loc.selectOption(next);}
    else await loc.dispatchEvent('change');
  }else{
    await loc.click({timeout:3000});
  }
}

async function assertHealthySurface(page){
  await expect(page.locator('#csTop')).toHaveCount(1);
  await expect(page.locator('#legacyBridge')).toBeHidden();
  const hasSurface=await page.evaluate(()=>{
    const view=(document.querySelector('#view')?.innerText||'').trim();
    const overlay=document.querySelector('#overlay')?.classList.contains('show');
    const modal=document.querySelector('#modalBackdrop')?.classList.contains('show');
    return view.length>0||overlay||modal;
  });
  if(!hasSurface) throw new Error('blank customer surface after click');
}

test('all visible route controls survive isolated customer clicks without runtime failure',async({page})=>{
  const runtime=await boot(page);
  const baseline=await captureStorage(page);
  const routes=await page.evaluate(()=>Array.from(new Set(window.LPClient.menuGroups.flatMap(g=>g.items.map(i=>i[0])).concat(['csHome','csStations','csSetup']))));
  const failures=[];
  const coverage=[];

  for(const route of routes){
    await resetToBaseline(page,baseline);
    await go(page,route);
    const list=await controls(page);
    coverage.push({route,total:list.length,controls:list});
    for(let i=0;i<list.length;i++){
      const c=list[i];
      const beforeErrors=runtime.length;
      try{
        await resetToBaseline(page,baseline);
        await go(page,route);
        const fresh=await controls(page);
        if(i>=fresh.length) throw new Error(`control missing from clean baseline at index ${i}`);
        await activate(page,i);
        await page.waitForTimeout(150);
        const newErrors=runtime.slice(beforeErrors);
        if(newErrors.length) throw new Error(newErrors.join(' | '));
        await assertHealthySurface(page);
      }catch(e){
        failures.push(`${route} :: #${i} ${c.tag}/${c.type} ${c.id||c.text||c.data||c.name||'unnamed'} => ${e.message}`);
      }
    }
  }

  const total=coverage.reduce((n,r)=>n+r.total,0);
  console.log('V230_CLICK_MATRIX_COVERAGE '+JSON.stringify(coverage.map(r=>({route:r.route,total:r.total}))));
  console.log(`V230_CLICK_MATRIX_TOTAL ${total}`);
  if(failures.length) console.error('V230_CLICK_MATRIX_FAILURES\n'+failures.join('\n'));
  expect(total).toBeGreaterThan(30);
  expect(failures,failures.join('\n')).toEqual([]);
  expect(runtime).toEqual([]);
  console.log('V230_CLICK_MATRIX_OK');
});

test('every settings subsection and every visible action inside it survives isolated use',async({page})=>{
  const runtime=await boot(page);
  const baseline=await captureStorage(page);
  await go(page,'settings');
  const sections=await page.locator('#view [data-settings]').evaluateAll(els=>els.map(el=>({id:el.dataset.settings,label:(el.innerText||'').trim().replace(/\s+/g,' ').slice(0,100)})));
  const failures=[];
  const coverage=[];

  for(const section of sections){
    await resetToBaseline(page,baseline);
    await go(page,'settings');
    const tile=page.locator(`#view [data-settings="${section.id}"]`);
    await expect(tile).toBeVisible();
    await tile.click();
    await page.waitForTimeout(100);
    const list=await controls(page);
    coverage.push({section:section.id,total:list.length});

    for(let i=0;i<list.length;i++){
      const c=list[i];
      const beforeErrors=runtime.length;
      try{
        await resetToBaseline(page,baseline);
        await go(page,'settings');
        const freshTile=page.locator(`#view [data-settings="${section.id}"]`);
        await freshTile.click();
        await page.waitForTimeout(80);
        const fresh=await controls(page);
        if(i>=fresh.length) throw new Error(`nested control missing from clean baseline at index ${i}`);
        await activate(page,i);
        await page.waitForTimeout(160);
        const newErrors=runtime.slice(beforeErrors);
        if(newErrors.length) throw new Error(newErrors.join(' | '));
        await assertHealthySurface(page);
      }catch(e){
        failures.push(`settings/${section.id} :: #${i} ${c.tag}/${c.type} ${c.id||c.text||c.data||c.name||'unnamed'} => ${e.message}`);
      }
    }
  }

  const total=coverage.reduce((n,x)=>n+x.total,0);
  console.log('V230_SETTINGS_DEPTH2_COVERAGE '+JSON.stringify(coverage));
  console.log(`V230_SETTINGS_DEPTH2_TOTAL ${total}`);
  if(failures.length) console.error('V230_SETTINGS_DEPTH2_FAILURES\n'+failures.join('\n'));
  expect(sections.length).toBeGreaterThanOrEqual(10);
  expect(total).toBeGreaterThan(20);
  expect(failures,failures.join('\n')).toEqual([]);
  expect(runtime).toEqual([]);
  console.log('V230_SETTINGS_DEPTH2_OK');
});
