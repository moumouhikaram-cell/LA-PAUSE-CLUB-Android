const { test, expect } = require('@playwright/test');

const URL = process.env.LP_E2E_URL || 'http://127.0.0.1:4173/index.html';

const defaultAgent = {
  agentId: 'agent-tv-test-1',
  name: 'TV TEST 1',
  deviceType: 'ANDROID_TV_AGENT',
  version: 'agent-1.0.0',
  protocol: 'LA_PAUSE_DEVICE_AGENT_V1',
  address: 'http://192.168.50.20:8080',
  capabilities: { display:true, overlay:true, remoteControl:true, heartbeat:true, power:true, input:true },
  supportedCommands: ['REFRESH_STATUS','SHOW_MESSAGE','SESSION_WARNING','SESSION_END','POWER_ON','POWER_OFF','SET_INPUT'],
  authRequired: false,
  pairingRequired: false
};

async function bootDevicePage(page){
  await page.goto(URL);
  await page.waitForFunction(() => document.body.classList.contains('nx-shell-ready') && window.LPClient?.go && window.LPSaas?.hasModule && typeof window.p2RenderMesh === 'function' && typeof window.v240StartDiscovery === 'function');
  const access = await page.evaluate(() => ({module:LPSaas.hasModule('M09_DEVICE_CONTROL'),debug:LPSaas.nativeSecurity?.().debug===true}));
  expect(access.module || access.debug).toBe(true);
  await page.evaluate(() => LPClient.go('deviceMesh'));
  await expect(page.locator('#v240DiscoverBtn')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(agent => {
    window.__agentFixture = agent;
    Object.defineProperty(window, 'ClientAndroid', {
      configurable: true,
      value: {
        getSafeInsetsJson(){ return '{"left":0,"top":0,"right":0,"bottom":0}'; },
        discoverLaPauseAgents(requestId){
          setTimeout(() => {
            window.onLaPauseLanDiscovery(requestId, {
              ok: true,
              localIp: '192.168.50.10',
              subnet: '192.168.50.0/24',
              scanned: 253,
              durationMs: 840,
              agents: [window.__agentFixture]
            });
          }, 25);
        }
      }
    });
  }, defaultAgent);
});

test('LAN discovery -> pair resource -> command -> home pulse', async ({ page }) => {
  await bootDevicePage(page);
  await page.locator('#v240DiscoverBtn').click();
  await expect(page.getByText('TV TEST 1')).toBeVisible();
  await expect(page.getByText('192.168.50.0/24')).toBeVisible();
  await expect(page.locator('[data-v240-associate="0"]')).toBeVisible();

  await page.evaluate(() => { p2ProbeDevice = async () => {}; });
  await page.locator('[data-v240-associate="0"]').click();
  const resource = await page.locator('#v240PairResource option').nth(1).getAttribute('value');
  expect(resource).toBeTruthy();
  await page.locator('#v240PairResource').selectOption(resource);
  await page.locator('#v240PairSave').click();

  await page.waitForFunction(() => (state.deviceRegistry||[]).some(d => d.agentId==='agent-tv-test-1' && d.pairingState==='PAIRED' && !!d.resourceId));
  const paired = await page.evaluate(() => {
    const d=(state.deviceRegistry||[]).find(x=>x.agentId==='agent-tv-test-1');
    return {id:d.id,name:d.name,type:d.deviceType,address:d.address,resourceId:d.resourceId,capabilities:d.capabilities,supportedCommands:d.supportedCommands,hasTokenField:Object.prototype.hasOwnProperty.call(d,'token')||Object.prototype.hasOwnProperty.call(d,'authToken')};
  });
  expect(paired.name).toBe('TV TEST 1');
  expect(paired.type).toBe('ANDROID_TV_AGENT');
  expect(paired.address).toBe('http://192.168.50.20:8080');
  expect(paired.capabilities.overlay).toBe(true);
  expect(paired.supportedCommands).toContain('SHOW_MESSAGE');
  expect(paired.hasTokenField).toBe(false);

  await page.evaluate(() => {
    const d=(state.deviceRegistry||[]).find(x=>x.agentId==='agent-tv-test-1');
    d.address='';
    p2RenderMesh();
    requestAnimationFrame(v240InjectDeviceControl);
  });
  await expect(page.locator(`[data-v240-message="${paired.id}"]`)).toBeVisible();
  await page.locator(`[data-v240-message="${paired.id}"]`).click();
  await page.locator('#v240MessageText').fill('Session terminée');
  await page.locator('#v240MsgSend').click();
  await page.waitForFunction(() => (state.deviceCommands||[]).some(c => c.commandType==='SHOW_MESSAGE' && c.payload?.text==='Session terminée'));

  await page.evaluate(() => LPClient.go('csHome'));
  await expect(page.locator('#v240DevicePulse')).toBeVisible();
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('la-pause-club-manager-v6')||'{}').deviceRegistry?.some(d=>d.agentId==='agent-tv-test-1'));
  expect(persisted).toBe(true);

  console.log('V240_LAN_DISCOVERY_OK');
  console.log('V240_DEVICE_PAIRING_OK');
  console.log('V240_DEVICE_COMMAND_OK');
  console.log('V240_HOME_DEVICE_PULSE_OK');
  console.log('V240_NO_TOKEN_IN_CLUB_STATE_OK');
  console.log('V240_DEVICE_CONTROL_E2E_OK');
});

test('discovery never auto-pairs an agent without operator action', async ({ page }) => {
  await bootDevicePage(page);
  await page.locator('#v240DiscoverBtn').click();
  await expect(page.getByText('TV TEST 1')).toBeVisible();
  const autoPaired = await page.evaluate(() => (state.deviceRegistry||[]).some(d=>d.agentId==='agent-tv-test-1'));
  expect(autoPaired).toBe(false);
  console.log('V240_DISCOVERY_REQUIRES_OPERATOR_PAIR_OK');
});

test('optional controls follow the agent advertised commands, not assumptions', async ({ page }) => {
  await bootDevicePage(page);
  await page.evaluate(() => {
    window.__agentFixture = {
      agentId:'agent-safe-1',name:'AGENT SANS OVERLAY',deviceType:'ANDROID_TV_AGENT',version:'1.0.0',protocol:'LA_PAUSE_DEVICE_AGENT_V1',address:'http://192.168.50.21:8080',
      capabilities:{heartbeat:true,display:false,overlay:false,remoteControl:false,power:false,input:false,sessionLease:true},
      supportedCommands:['REFRESH_STATUS','RESTART_AGENT'],authRequired:false,pairingRequired:false
    };
    p2ProbeDevice=async()=>{};
  });
  await page.locator('#v240DiscoverBtn').click();
  await expect(page.getByText('AGENT SANS OVERLAY')).toBeVisible();
  await page.locator('[data-v240-associate="0"]').click();
  const resource = await page.locator('#v240PairResource option').nth(1).getAttribute('value');
  await page.locator('#v240PairResource').selectOption(resource);
  await page.locator('#v240PairSave').click();
  await page.waitForFunction(() => (state.deviceRegistry||[]).some(d=>d.agentId==='agent-safe-1'));
  const id = await page.evaluate(() => state.deviceRegistry.find(d=>d.agentId==='agent-safe-1').id);
  await page.evaluate(() => { p2RenderMesh(); requestAnimationFrame(v240InjectDeviceControl); });
  await expect(page.locator(`[data-v240-refresh="${id}"]`)).toBeVisible();
  await expect(page.locator(`[data-v240-message="${id}"]`)).toHaveCount(0);
  await expect(page.locator(`[data-v240-power-on="${id}"]`)).toHaveCount(0);
  await expect(page.locator(`[data-v240-power-off="${id}"]`)).toHaveCount(0);
  await expect(page.locator(`[data-v240-hdmi1="${id}"]`)).toHaveCount(0);
  console.log('V240_CAPABILITY_HONESTY_OK');
});

test('authenticated agent fails closed when secure Android storage is unavailable', async ({ page }) => {
  await bootDevicePage(page);
  await page.evaluate(() => {
    window.__agentFixture = {
      agentId:'agent-secure-1',name:'TV SECURE',deviceType:'ANDROID_TV_AGENT',version:'1.0.0',protocol:'LA_PAUSE_DEVICE_AGENT_V1',address:'http://192.168.50.22:8080',
      capabilities:{heartbeat:true,overlay:false},supportedCommands:['REFRESH_STATUS'],authRequired:true,pairingRequired:true,paired:false
    };
  });
  await page.locator('#v240DiscoverBtn').click();
  await page.locator('[data-v240-associate="0"]').click();
  await expect(page.locator('#v240PairCode')).toBeVisible();
  await page.locator('#v240PairCode').fill('123456');
  await page.locator('#v240PairSave').click();
  await page.waitForTimeout(80);
  const paired = await page.evaluate(() => (state.deviceRegistry||[]).some(d=>d.agentId==='agent-secure-1'));
  expect(paired).toBe(false);
  await expect(page.locator('#toast')).toContainText('Stockage sécurisé Android indisponible');
  console.log('V240_SECURE_PAIRING_FAILS_CLOSED_OK');
});
