const { test, expect } = require('@playwright/test');

const URL = process.env.LP_E2E_URL || 'http://127.0.0.1:4173/index.html';

async function bootDevicePage(page){
  await page.goto(URL);
  await page.waitForFunction(() => typeof window.renderView === 'function' && typeof window.p2RenderMesh === 'function' && typeof window.v240StartDiscovery === 'function');
  await page.evaluate(() => { window.currentView='deviceMesh'; window.renderView(); });
  await expect(page.locator('#v240DiscoverBtn')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
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
              agents: [{
                agentId: 'agent-tv-test-1',
                name: 'TV TEST 1',
                deviceType: 'ANDROID_TV_AGENT',
                version: 'agent-1.0.0',
                protocol: 'LA_PAUSE_DEVICE_AGENT_V1',
                address: 'http://192.168.50.20:8080',
                capabilities: { display:true, overlay:true, remoteControl:true, heartbeat:true, power:true, input:true }
              }]
            });
          }, 25);
        }
      }
    });
  });
});

test('LAN discovery -> pair resource -> command -> home pulse', async ({ page }) => {
  await bootDevicePage(page);
  await page.locator('#v240DiscoverBtn').click();
  await expect(page.getByText('TV TEST 1')).toBeVisible();
  await expect(page.getByText('192.168.50.0/24')).toBeVisible();
  await expect(page.locator('[data-v240-associate="0"]')).toBeVisible();

  await page.evaluate(() => { window.p2ProbeDevice = async () => {}; });
  await page.locator('[data-v240-associate="0"]').click();
  const resource = await page.locator('#v240PairResource option').nth(1).getAttribute('value');
  expect(resource).toBeTruthy();
  await page.locator('#v240PairResource').selectOption(resource);
  await page.locator('#v240PairSave').click();

  await page.waitForFunction(() => (window.state.deviceRegistry||[]).some(d => d.agentId==='agent-tv-test-1' && d.pairingState==='PAIRED' && !!d.resourceId));
  const paired = await page.evaluate(() => {
    const d=(window.state.deviceRegistry||[]).find(x=>x.agentId==='agent-tv-test-1');
    return {id:d.id,name:d.name,type:d.deviceType,address:d.address,resourceId:d.resourceId,capabilities:d.capabilities};
  });
  expect(paired.name).toBe('TV TEST 1');
  expect(paired.type).toBe('ANDROID_TV_AGENT');
  expect(paired.address).toBe('http://192.168.50.20:8080');
  expect(paired.capabilities.overlay).toBe(true);

  await page.evaluate(() => {
    const d=(window.state.deviceRegistry||[]).find(x=>x.agentId==='agent-tv-test-1');
    d.address='';
    window.p2RenderMesh();
    requestAnimationFrame(window.v240InjectDeviceControl);
  });
  await expect(page.locator(`[data-v240-message="${paired.id}"]`)).toBeVisible();
  await page.locator(`[data-v240-message="${paired.id}"]`).click();
  await page.locator('#v240MessageText').fill('Session terminée');
  await page.locator('#v240MsgSend').click();
  await page.waitForFunction(() => (window.state.deviceCommands||[]).some(c => c.commandType==='SHOW_MESSAGE' && c.payload?.text==='Session terminée'));

  await page.evaluate(() => { window.currentView='home'; window.renderView(); });
  await page.waitForTimeout(60);
  await expect(page.locator('#v240DevicePulse')).toBeVisible();
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('la-pause-club-manager-v6')||'{}').deviceRegistry?.some(d=>d.agentId==='agent-tv-test-1'));
  expect(persisted).toBe(true);

  console.log('V240_LAN_DISCOVERY_OK');
  console.log('V240_DEVICE_PAIRING_OK');
  console.log('V240_DEVICE_COMMAND_OK');
  console.log('V240_HOME_DEVICE_PULSE_OK');
  console.log('V240_DEVICE_CONTROL_E2E_OK');
});

test('discovery never auto-pairs an agent without operator action', async ({ page }) => {
  await bootDevicePage(page);
  await page.locator('#v240DiscoverBtn').click();
  await expect(page.getByText('TV TEST 1')).toBeVisible();
  const autoPaired = await page.evaluate(() => (window.state.deviceRegistry||[]).some(d=>d.agentId==='agent-tv-test-1'));
  expect(autoPaired).toBe(false);
  console.log('V240_DISCOVERY_REQUIRES_OPERATOR_PAIR_OK');
});
