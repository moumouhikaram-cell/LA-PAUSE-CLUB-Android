'use strict';
/* Read-only CDP locator/state probe for the historical v1.6 stabilization journey.
 * Never clicks, types, mutates storage, changes state or calls render functions.
 */
const mode=process.argv[2]||'';
const arg=process.argv.slice(3).join(' ');
const port=Number(process.env.LP160_CDP_PORT||9229);
const MAX_ATTEMPTS=3;
function fail(msg){console.error('V160_STABILIZATION_CDP_FAIL '+msg);process.exit(2);}
async function pages(){const r=await fetch(`http://127.0.0.1:${port}/json`);if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}
function rectBody(find){return `(()=>{const e=${find};if(!e)return null;const r=e.getBoundingClientRect(),s=getComputedStyle(e),a=document.activeElement;return {tag:e.tagName,id:e.id||'',text:(e.textContent||'').trim().slice(0,160),value:'value'in e?e.value:null,checked:'checked'in e?!!e.checked:null,disabled:!!e.disabled,readOnly:!!e.readOnly,pointerEvents:s.pointerEvents,display:s.display,visibility:s.visibility,active:a===e,activeId:a?(a.id||a.name||a.tagName):'',left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,innerWidth,innerHeight,scrollY,scrollHeight:document.documentElement.scrollHeight};})()`;}
function expression(){
  if(mode==='rect-id')return rectBody(`document.getElementById(${JSON.stringify(arg)})`);
  if(mode==='rect-css')return rectBody(`document.querySelector(${JSON.stringify(arg)})`);
  if(mode==='rect-text')return rectBody(`[...document.querySelectorAll('button,a,[role="button"]')].find(x=>((x.textContent||'').trim().toLowerCase()).includes(${JSON.stringify(arg.toLowerCase())}))`);
  if(mode==='state')return `(()=>{let st=null,cv=null,shift=null,pending=null;try{st=(typeof state!=='undefined'&&state)||null}catch(_e){}try{cv=(typeof currentView!=='undefined')?String(currentView):null}catch(_e){}try{shift=(typeof currentShift==='function')?currentShift():null}catch(_e){}try{pending=window.LP160Stabilization&&LP160Stabilization.getPendingSessionStart?LP160Stabilization.getPendingSessionStart():null}catch(_e){}const active=(st?.sessions||[]).filter(s=>s.status==='active'||s.status==='paused');const paid=(st?.payments||[]);const orders=(st?.orders||[]);const coca=(st?.products||[]).find(p=>p.id==='prod-cocacola');return {currentView:cv,shift:shift?{id:shift.id,status:shift.status,openedAt:shift.openedAt,closedAt:shift.closedAt||null}:null,pending:pending?{stationId:pending.stationId,snackCart:pending.draft?.snackCart||{},customerId:pending.draft?.customerId||null}:null,sessions:(st?.sessions||[]).length,activeSessions:active.length,payments:paid.length,orders:orders.length,paidOrders:orders.filter(o=>String(o.status||'').toLowerCase()==='paid').length,clients:(st?.clients||[]).length,cocaStock:coca==null?null:Number(coca.stock),stations:(st?.stations||[]).length,products:(st?.products||[]).length,viewText:(document.getElementById('view')?.textContent||'').trim().slice(0,600),sheetOpen:document.getElementById('overlay')?.classList.contains('show')||document.getElementById('overlay')?.classList.contains('open')||false,modalOpen:document.getElementById('modalBackdrop')?.classList.contains('show')||document.getElementById('modalBackdrop')?.classList.contains('open')||false,drawerOpen:document.getElementById('drawer')?.classList.contains('show')||document.getElementById('drawer')?.classList.contains('open')||false};})()`;
  fail('unknown mode '+mode);
}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function evaluateOnce(page){
  const ws=new WebSocket(page.webSocketDebuggerUrl),id=1;
  try{
    return await new Promise((resolve,reject)=>{
      let settled=false;
      const done=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);try{ws.close();}catch(_){}fn(value);};
      const timer=setTimeout(()=>done(reject,new Error('timeout')),9000);
      ws.onopen=()=>ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression:expression(),returnByValue:true,awaitPromise:true}}));
      ws.onerror=()=>done(reject,new Error('websocket error'));
      ws.onmessage=ev=>{let m;try{m=JSON.parse(String(ev.data));}catch(_){return;}if(m.id!==id)return;if(m.error)return done(reject,new Error(JSON.stringify(m.error)));if(m.result&&m.result.exceptionDetails)return done(reject,new Error('Runtime exception'));done(resolve,m.result?.result?.value??null);};
    });
  }finally{try{ws.close();}catch(_){}}
}
async function main(){
  let lastError=null;
  for(let attempt=1;attempt<=MAX_ATTEMPTS;attempt++){
    try{
      const list=await pages(),page=list.find(x=>x.type==='page'&&x.webSocketDebuggerUrl)||list.find(x=>x.webSocketDebuggerUrl);
      if(!page)throw new Error('no debuggable WebView page');
      const result=await evaluateOnce(page);
      process.stdout.write(JSON.stringify(result));
      return;
    }catch(e){
      lastError=e;
      if(attempt<MAX_ATTEMPTS)await sleep(200*attempt);
    }
  }
  throw lastError||new Error('CDP probe failed');
}
main().catch(e=>fail(e&&e.message?e.message:String(e)));
