const { test, expect } = require('@playwright/test');
const URL=process.env.LP_E2E_URL||'http://127.0.0.1:4173/index.html';

async function boot(page){
  await page.goto(URL);
  await page.waitForFunction(()=>document.body.classList.contains('nx-shell-ready')&&window.LPClient?.views?.nxModules&&window.LPClient?.views?.nxSettings);
}

test('raw document boots behind LA PAUSE screen before product runtime',async({request})=>{
  const response=await request.get(URL);
  expect(response.ok()).toBeTruthy();
  const html=await response.text();
  expect(html).toContain('<body class="lp-next-booting">');
  expect(html).toContain('id="lpBootScreen"');
  expect(html).toContain('client-shell-next-v240.css');
  expect(html).toContain('client-shell-next-v240.js');
  expect(html.indexOf('client-shell-next-v240.js')).toBeLessThan(html.indexOf('client-product-boot.js'));
  console.log('V240_FIRST_FRAME_BOOT_GUARD_OK');
});

test('next SaaS shell owns visible chrome and old chrome is gone',async({page})=>{
  await boot(page);
  await expect(page.locator('#nxTop')).toBeVisible();
  await expect(page.locator('#nxDock')).toBeVisible();
  await expect(page.locator('#csTop')).toHaveCount(0);
  await expect(page.locator('#csDock')).toHaveCount(0);
  await expect(page.locator('#csRail')).toHaveCount(0);
  await expect(page.locator('#csMenuPanel')).toHaveCount(0);
  await expect(page.locator('#lpBootScreen')).toHaveCount(0);
  await expect(page.locator('#nxBrandName')).toContainText(/LA PAUSE|CLUB/i);
  console.log('V240_OLD_CHROME_ELIMINATED_OK');
  console.log('V240_NEXT_SAAS_SHELL_OK');
});

test('new navigation is SaaS module-oriented, not PS-only',async({page})=>{
  await boot(page);
  await page.locator('#nxMore').click();
  await expect(page.locator('#nxMenuLayer')).toHaveClass(/show/);
  await expect(page.getByText('Centre de navigation',{exact:true})).toBeVisible();
  await expect(page.getByText('Exploiter',{exact:true})).toBeVisible();
  await expect(page.getByText('Vendre',{exact:true})).toBeVisible();
  await expect(page.getByText('Piloter',{exact:true})).toBeVisible();
  await expect(page.getByText('Plateforme',{exact:true})).toBeVisible();
  await expect(page.getByText('Caisse',{exact:true}).first()).toBeVisible();
  await expect(page.getByText('Compta & finance',{exact:true})).toBeVisible();
  await expect(page.getByText('CRM & fidélité',{exact:true})).toBeVisible();
  await expect(page.getByText('Device Control',{exact:true})).toBeVisible();
  await expect(page.getByText('API & intégrations',{exact:true})).toBeVisible();
  await expect(page.getByText('AI Operator',{exact:true})).toBeVisible();
  console.log('V240_SAAS_MODULE_NAVIGATION_OK');
});

test('module marketplace exposes modular commercial architecture',async({page})=>{
  await boot(page);
  await page.evaluate(()=>LPClient.go('nxModules'));
  await expect(page.getByRole('heading',{name:'Modules LA PAUSE OS'})).toBeVisible();
  for(const [id,name] of [['M01_OPERATIONS','Gestion'],['M02_POS','Caisse'],['M03_INVENTORY','Stock & Snacks'],['M04_FINANCE','Compta & Finance'],['M05_CRM','CRM & Fidélité'],['M06_MARKETING','Marketing & Growth'],['M09_DEVICE_CONTROL','Device Control'],['M10_ANALYTICS','Owner Analytics'],['M11_PLAYER_PORTAL','Espace Joueur'],['M13_MULTI_SITE','Multi-site'],['M14_API_INTEGRATIONS','API & Intégrations'],['M15_AI_OPERATOR','AI Operator']]){
    await expect(page.locator(`[data-module-card="${id}"]`)).toBeVisible();
    await expect(page.getByText(name,{exact:true}).first()).toBeVisible();
  }
  expect(await page.locator('[data-module-card]').count()).toBe(15);
  console.log('V240_MODULE_MARKETPLACE_OK');
});

test('settings route opens the new domain-organized settings hub',async({page})=>{
  await boot(page);
  await page.evaluate(()=>LPClient.go('settings'));
  await expect(page.getByRole('heading',{name:'Paramètres'})).toBeVisible();
  await expect(page.getByText('Organisation & métiers',{exact:true})).toBeVisible();
  await expect(page.getByText('Commerce',{exact:true})).toBeVisible();
  await expect(page.getByText('SaaS & plateforme',{exact:true})).toBeVisible();
  await expect(page.getByText('Sécurité & appareils',{exact:true})).toBeVisible();
  await expect(page.getByText('Paramètres Sessions',{exact:true})).toHaveCount(0);
  console.log('V240_NEW_SETTINGS_HUB_OK');
});
