'use strict';
const { test, expect } = require('@playwright/test');

const APP_URL = process.env.LP_E2E_URL || 'http://127.0.0.1:4173/index.html';
const STORAGE_KEY = 'la-pause-club-manager-v6';
test.setTimeout(180000);

async function boot(page){
  await page.setViewportSize({width:412,height:915});
  await page.addInitScript(() => {
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
      saveText(){return true;}, getSecureValue(){return '';}, setSecureValue(){return true;}, deleteSecureValue(){return true;},
      getDeviceInfo(){return '{}';}, httpRequest(){return JSON.stringify({status:200,body:{}});}
    };
    window.open=()=>null;
  });
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.LPClient&&document.body.classList.contains('cs-ready'));
}

async function go(page,route){
  await page.evaluate(r=>window.LPClient.go(r),route);
  await expect.poll(()=>page.evaluate(()=>window.LPClient.canonical(window.LPClient.lastRendered))).toBe(route);
  await expect(page.locator('#view')).not.toBeEmpty();
}

async function state(page){
  return page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'{}'),STORAGE_KEY);
}

test('operational records survive a full app reload', async ({page})=>{
  await boot(page);
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.LPClient&&document.body.classList.contains('cs-ready'));

  // CRM: create a real member record.
  await go(page,'clients');
  await page.locator('#clientAddV15').click();
  await page.locator('#cFirst').fill('QA');
  await page.locator('#cLast').fill('Persist');
  await page.locator('#cPhone').fill('0600000230');
  await page.locator('#modalOk').click();
  await expect(page.locator('#view')).toContainText('QA Persist');

  // Catalogue/stock: create a product with price and stock.
  await go(page,'products');
  await page.locator('#prodAdd15').click();
  await page.locator('#pName15').fill('QA Cola 230');
  await page.locator('#pPrice15').fill('12');
  await page.locator('#pStock15').fill('9');
  await page.locator('#modalOk').click();
  await expect(page.locator('#view')).toContainText('QA Cola 230');

  // Reservation: create a prepaid protected booking.
  await go(page,'reservations');
  await page.locator('#bookingAddV15').click();
  await page.locator('#bkName').fill('QA Booking 230');
  await page.locator('#modalOk').click();
  await expect(page.locator('#view')).toContainText('QA Booking 230');

  // Competition: create a tournament record.
  await go(page,'tournaments');
  await page.locator('#tourAddV15').click();
  await page.locator('#tName15').fill('QA Cup 230');
  await page.locator('#modalOk').click();
  await expect(page.locator('#view')).toContainText('QA Cup 230');

  // Cash: open a shift and prove it is really considered open before reload.
  await go(page,'cash');
  await expect(page.locator('#openShiftBtn')).toBeVisible();
  await page.locator('#openShiftBtn').click();
  await page.locator('#openingCash').fill('100');
  await page.locator('#modalOk').click();
  await expect(page.locator('#closeShiftBtn')).toBeVisible();

  const before=await state(page);
  expect(before.clients.some(c=>c.name==='QA Persist'&&c.phone==='0600000230')).toBeTruthy();
  expect(before.products.some(p=>p.name==='QA Cola 230'&&Number(p.stock)===9&&Number(p.price)===12)).toBeTruthy();
  expect(before.bookings.some(b=>b.customerName==='QA Booking 230'&&String(b.status).toUpperCase()==='CONFIRMED')).toBeTruthy();
  expect(before.tournaments.some(t=>t.name==='QA Cup 230')).toBeTruthy();
  expect(before.shifts.some(s=>String(s.status).toUpperCase()==='OPEN')).toBeTruthy();

  // Full reload: this is the persistence boundary that matters on the dedicated tablet.
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.LPClient&&document.body.classList.contains('cs-ready'));

  const after=await state(page);
  expect(after.clients.some(c=>c.name==='QA Persist'&&c.phone==='0600000230')).toBeTruthy();
  expect(after.products.some(p=>p.name==='QA Cola 230'&&Number(p.stock)===9&&Number(p.price)===12)).toBeTruthy();
  expect(after.bookings.some(b=>b.customerName==='QA Booking 230'&&String(b.status).toUpperCase()==='CONFIRMED')).toBeTruthy();
  expect(after.tournaments.some(t=>t.name==='QA Cup 230')).toBeTruthy();
  expect(after.shifts.some(s=>String(s.status).toUpperCase()==='OPEN')).toBeTruthy();

  await go(page,'clients');
  await expect(page.locator('#view')).toContainText('QA Persist');
  await go(page,'products');
  await expect(page.locator('#view')).toContainText('QA Cola 230');
  await go(page,'reservations');
  await expect(page.locator('#view')).toContainText('QA Booking 230');
  await go(page,'tournaments');
  await expect(page.locator('#view')).toContainText('QA Cup 230');
  await go(page,'cash');
  await expect(page.locator('#closeShiftBtn')).toBeVisible();

  console.log('V230_PERSIST_CLIENT_OK');
  console.log('V230_PERSIST_PRODUCT_OK');
  console.log('V230_PERSIST_BOOKING_OK');
  console.log('V230_PERSIST_TOURNAMENT_OK');
  console.log('V230_PERSIST_SHIFT_OK');
  console.log('V230_OPERATIONAL_PERSISTENCE_OK');
});
