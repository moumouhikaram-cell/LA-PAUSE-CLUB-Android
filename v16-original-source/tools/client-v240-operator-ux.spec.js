const { test, expect } = require('@playwright/test');
const URL=process.env.LP_E2E_URL||'http://127.0.0.1:4173/index.html';

async function boot(page){
  await page.goto(URL);
  await page.waitForFunction(()=>window.LPClient?.views?.csHome && window.LPClient?.dynamicMediaFor && typeof window.drawStartSheet==='function');
}
async function seed(page){
  await page.evaluate(()=>{
    const base=state.stations?.[0]||{sort:1,capabilities:{},mediaPosition:'center'};
    const mk=(id,name,t,type,sort)=>({...base,id,name,enabled:true,sort,osResourceType:t,type,ratePlanId:null,mediaUrl:'',defaultMedia:''});
    state.stations=[
      mk('ux-console','PS5 UX','CONSOLE','PS5',1),
      mk('ux-billiard','BILLARD UX','BILLIARD_TABLE','BILLIARD',2),
      mk('ux-snooker','SNOOKER UX','SNOOKER_TABLE','SNOOKER',3)
    ];
    state.sessions=[];state.orders=[];state.clients=[];state.ui=state.ui||{};state.ui.opsActivityType='CONSOLE';
    state.ratePlans=(state.ratePlans||[]).filter(p=>!['CONSOLE','BILLIARD_TABLE','SNOOKER_TABLE'].includes(String(p.resourceType||'').toUpperCase()));
    const ts=Date.now();
    state.ratePlans.push(
      {id:'ux-rate-console',scope:'TYPE',resourceType:'CONSOLE',name:'Console',billingModel:'TIME_PRORATED',pricingModel:'PER_HOUR_PLAYERS',hourlyRate:22,playerRates:{'1':22,'2':28},enabled:true,createdAt:ts,updatedAt:ts,revision:1},
      {id:'ux-rate-billiard',scope:'TYPE',resourceType:'BILLIARD_TABLE',name:'Billard',billingModel:'PER_GAME',pricingModel:'PER_GAME',unitPrice:7,enabled:true,createdAt:ts,updatedAt:ts,revision:1},
      {id:'ux-rate-snooker',scope:'TYPE',resourceType:'SNOOKER_TABLE',name:'Snooker',billingModel:'PER_GAME',pricingModel:'PER_GAME',unitPrice:8,enabled:true,createdAt:ts,updatedAt:ts,revision:1}
    );
    saveState();
  });
}

test('métier-first home never mixes resources and restores idle PS5 dynamic media',async({page})=>{
  await boot(page);await seed(page);
  await page.evaluate(()=>{currentView='csHome';LPClient.views.csHome();});
  await expect(page.locator('.ops-ux-dashboard')).toBeVisible();
  await expect(page.getByText('PS5 UX',{exact:true})).toBeVisible();
  await expect(page.getByText('SNOOKER UX',{exact:true})).toHaveCount(0);
  const src=await page.locator('[data-cs-station="ux-console"] .ops-resource-media img').getAttribute('src');
  expect(src).toContain('media/ps5-available.png');
  await page.locator('[data-ux-activity="SNOOKER_TABLE"]').click();
  await expect(page.getByText('SNOOKER UX',{exact:true})).toBeVisible();
  await expect(page.getByText('PS5 UX',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Marketing actionnable')).toBeVisible();
  console.log('V240_METIER_SEPARATION_OK');
  console.log('V240_DYNAMIC_IDLE_MEDIA_OK');
  console.log('V240_MARKETING_SURFACE_OK');
});

test('session start has no selected fake walk-in client and game media changes dynamically',async({page})=>{
  await boot(page);await seed(page);
  await page.evaluate(()=>window.openStation('ux-console'));
  await expect(page.locator('#opsSessionForm')).toBeVisible();
  await expect(page.locator('#opsClient')).toHaveCount(0);
  await expect(page.getByText('Non identifié',{exact:true})).toBeVisible();
  await expect(page.locator('[data-ux-client-open]')).toBeVisible();
  await expect(page.getByText('Client passage',{exact:true})).toHaveCount(0);
  const first=await page.locator('#opsSessionForm .ops-session-media img').getAttribute('src');
  expect(first).toContain('football-dynamic.png');
  await page.locator('[data-ux-game="racing"]').click();
  const second=await page.locator('#opsSessionForm .ops-session-media img').getAttribute('src');
  expect(second).toContain('racing-dynamic.png');
  console.log('V240_NO_FAKE_WALKIN_SELECT_OK');
  console.log('V240_DYNAMIC_GAME_MEDIA_OK');
});

test('non-game métier start does not waste mobile space with a hero image',async({page})=>{
  await boot(page);await seed(page);
  await page.evaluate(()=>window.openStation('ux-billiard'));
  await expect(page.locator('#opsSessionForm')).toBeVisible();
  await expect(page.locator('#opsSessionForm .ops-session-media')).toBeHidden();
  await expect(page.locator('#opsSessionForm [data-ux-game]')).toHaveCount(0);
  console.log('V240_NON_GAME_FAST_START_OK');
});

test('saving Snooker métier price clears stale resource override and survives reload',async({page})=>{
  await boot(page);await seed(page);
  await page.evaluate(()=>{
    const st=state.stations.find(s=>s.id==='ux-snooker');
    state.ratePlans.push({id:'ux-old-snooker-resource',scope:'RESOURCE',resourceId:st.id,resourceType:'SNOOKER_TABLE',name:'Ancien tarif',billingModel:'PER_GAME',pricingModel:'PER_GAME',unitPrice:3,enabled:true,createdAt:Date.now(),updatedAt:Date.now(),revision:1});
    st.ratePlanId='ux-old-snooker-resource';
    currentView='settings';settingsSection='pricing';state.ui.settingsSection='pricing';saveState();window.renderSettingsV230();
  });
  const card=page.locator('[data-ops-price-type="SNOOKER_TABLE"]');
  await expect(card).toBeVisible();
  await card.locator('[data-ops-price-model="SNOOKER_TABLE"]').selectOption('PER_GAME');
  await card.locator('[data-price-a="SNOOKER_TABLE"]').fill('13');
  await card.locator('[data-ops-price-save="SNOOKER_TABLE"]').click();
  await page.waitForTimeout(80);
  const result=await page.evaluate(()=>{
    const st=state.stations.find(s=>s.id==='ux-snooker');
    const p=(state.ratePlans||[]).find(x=>x.scope==='TYPE'&&x.resourceType==='SNOOKER_TABLE'&&x.enabled!==false);
    return {ratePlanId:st.ratePlanId||null,price:p?.unitPrice||0,model:p?.billingModel||''};
  });
  expect(result.ratePlanId).toBeNull();expect(result.price).toBe(13);expect(result.model).toBe('PER_GAME');
  await page.reload();await page.waitForFunction(()=>window.LPClient?.views?.csHome && Array.isArray(state?.ratePlans));
  const persisted=await page.evaluate(()=>{const st=state.stations.find(s=>s.id==='ux-snooker');const p=state.ratePlans.find(x=>x.scope==='TYPE'&&x.resourceType==='SNOOKER_TABLE'&&x.enabled!==false);return {rid:st?.ratePlanId||null,price:p?.unitPrice||0}});
  expect(persisted.rid).toBeNull();expect(persisted.price).toBe(13);
  console.log('V240_SNOOKER_PRICE_PERSISTENCE_OK');
});

test('Billard per-game active session never becomes a legacy negative countdown',async({page})=>{
  await boot(page);await seed(page);
  await page.evaluate(()=>{
    const s={id:'ux-billard-session',stationId:'ux-billiard',resourceId:'ux-billiard',resourceType:'BILLIARD_TABLE',status:'active',mode:'unit',billingModel:'PER_GAME',startAt:Date.now()-20*60000,endAt:null,pausedAt:null,pauseTotalMs:0,players:2,plannedMinutes:null,units:1,unitPrice:7,pricingSnapshot:{billingModel:'PER_GAME',unitPrice:7,resourceType:'BILLIARD_TABLE'},baseAmount:7,discountAmount:0,totalAmount:7,customerId:null,gameTitle:'Billard',createdAt:Date.now(),updatedAt:Date.now(),revision:1};
    state.sessions=[s];saveState();window.drawActiveSheet(s);
  });
  await expect(page.locator('#activeSheetTimer')).toHaveText('1 PARTIE');
  await page.waitForTimeout(1300);
  await expect(page.locator('#activeSheetTimer')).toHaveText('1 PARTIE');
  await expect(page.locator('#activeSheetTimer')).not.toContainText('-');
  await page.evaluate(()=>{const s=state.sessions.find(x=>x.id==='ux-billard-session');s.units=2;s.totalAmount=14;LPSessionSemanticGuard.enforce()});
  await expect(page.locator('#activeSheetTimer')).toHaveText('2 PARTIES');
  console.log('V240_PER_GAME_TIMER_SEMANTICS_OK');
});
