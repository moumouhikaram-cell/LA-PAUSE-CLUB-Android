const { test, expect } = require('@playwright/test');
const URL=process.env.LP_E2E_URL||'http://127.0.0.1:4173/index.html';

async function boot(page){
  await page.goto(URL);
  await page.waitForFunction(()=>document.body.classList.contains('nx-shell-ready')&&window.LPClient?.views?.deviceMesh&&window.LPClient?.views?.finance&&window.LPClient?.views?.owner&&window.LPClient?.views?.team);
}

async function openWorkspace(page,route,key){
  await page.evaluate(r=>LPClient.go(r),route);
  const ws=page.locator(`[data-nx-workspace="${key}"]`);
  await expect(ws).toBeVisible();
  await expect(ws).not.toContainText(/P1 ·|P2 ·|P3 ·|TRUST & PROFIT ENGINE|FINANCE CONTROL|DEVICE MESH/i);
  return ws;
}

test('Device Control is a clean SaaS workspace while retaining control hooks',async({page})=>{
  await boot(page);
  const ws=await openWorkspace(page,'deviceMesh','device-control');
  await expect(ws.getByRole('heading',{name:'Appareils & automatisation'})).toBeVisible();
  await expect(page.locator('#v240DiscoverBtn')).toBeVisible();
  await expect(page.locator('.p2-device-card').first()).toBeVisible();
  console.log('V240_DEVICE_WORKSPACE_OK');
});

test('Finance and Owner use next SaaS workspaces',async({page})=>{
  await boot(page);
  const fin=await openWorkspace(page,'finance','finance');
  await expect(fin.getByRole('heading',{name:'Finance'})).toBeVisible();
  const owner=await openWorkspace(page,'owner','owner');
  await expect(owner.getByRole('heading',{name:'Pilotage propriétaire'})).toBeVisible();
  console.log('V240_FINANCE_WORKSPACE_OK');
  console.log('V240_OWNER_WORKSPACE_OK');
});

test('Team, Multi-site, Integrations and AI are SaaS-native surfaces',async({page})=>{
  await boot(page);
  for(const [route,key,heading] of [
    ['team','team','Équipe & accès'],
    ['multiSite','multi-site','Établissements & branches'],
    ['integrations','integrations','Intégrations'],
    ['ai','ai','AI Operator']
  ]){
    const ws=await openWorkspace(page,route,key);
    await expect(ws.getByRole('heading',{name:heading})).toBeVisible();
  }
  console.log('V240_PLATFORM_WORKSPACES_OK');
});

test('Cloud workspace exposes cross-platform sync contract',async({page})=>{
  await boot(page);
  const ws=await openWorkspace(page,'saas','cloud');
  await expect(ws.getByRole('heading',{name:'Cloud & synchronisation'})).toBeVisible();
  await expect(ws.getByText('Commandes idempotentes',{exact:true})).toBeVisible();
  await expect(ws.getByText('Inbox / outbox',{exact:true})).toBeVisible();
  console.log('V240_CROSS_PLATFORM_SYNC_WORKSPACE_OK');
});
