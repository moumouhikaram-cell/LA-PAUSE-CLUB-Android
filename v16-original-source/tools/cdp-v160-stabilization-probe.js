'use strict';
/* Read-only CDP locator/state probe for the historical v1.6 stabilization journey.
 * CLI calls are forwarded to one localhost daemon so successive physical Android reads reuse
 * a single WebSocket. The daemon never clicks, types, mutates storage or calls render functions.
 */
const http=require('http');
const {spawn,spawnSync}=require('child_process');
const mode=process.argv[2]||'';
const arg=process.argv.slice(3).join(' ');
const port=Number(process.env.LP160_CDP_PORT||9229);
const DAEMON_PORT=Number(process.env.LP160_CDP_DAEMON_PORT||9230);
const MAX_ATTEMPTS=4;
const EVALUATE_TIMEOUT_MS=4500;
const DAEMON_REQUEST_TIMEOUT_MS=40000;
const IS_DAEMON=mode==='--daemon';
function fail(msg){console.error('V160_STABILIZATION_CDP_FAIL '+msg);process.exit(2);}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function adb(args,timeout=3500){
  const r=spawnSync('adb',args,{encoding:'utf8',timeout,maxBuffer:1024*1024});
  if(r.error)throw r.error;
  if(r.status!==0)throw new Error(`adb ${args.join(' ')} failed: ${(r.stderr||'').trim()||r.status}`);
  return r.stdout||'';
}
function repairForward(){
  const unix=adb(['shell','cat','/proc/net/unix']);
  const sockets=unix.split(/\r?\n/).filter(line=>line.includes('webview_devtools_remote'));
  if(!sockets.length)throw new Error('no WebView devtools socket');
  const sock=(sockets[sockets.length-1].trim().split(/\s+/).pop()||'').replace(/^@/,'');
  if(!sock)throw new Error('empty WebView devtools socket');
  spawnSync('adb',['forward','--remove',`tcp:${port}`],{encoding:'utf8',timeout:2500});
  adb(['forward',`tcp:${port}`,`localabstract:${sock}`],3500);
  return sock;
}
function pages(){
  const url=`http://127.0.0.1:${port}/json`;
  const r=spawnSync('curl',['-fsS','--max-time','3',url],{encoding:'utf8',timeout:4500,maxBuffer:2*1024*1024});
  if(r.error)throw r.error;
  if(r.status!==0)throw new Error(`curl CDP discovery failed: ${(r.stderr||'').trim()||r.status}`);
  let parsed;
  try{parsed=JSON.parse(r.stdout||'[]');}
  catch(e){throw new Error(`invalid CDP discovery JSON: ${e.message}`);}
  if(!Array.isArray(parsed))throw new Error('CDP discovery response is not an array');
  return parsed;
}
function rectBody(find){return `(()=>{const e=${find};if(!e)return null;const r=e.getBoundingClientRect(),s=getComputedStyle(e),a=document.activeElement;return {tag:e.tagName,id:e.id||'',text:(e.textContent||'').trim().slice(0,160),value:'value'in e?e.value:null,checked:'checked'in e?!!e.checked:null,disabled:!!e.disabled,readOnly:!!e.readOnly,pointerEvents:s.pointerEvents,display:s.display,visibility:s.visibility,active:a===e,activeId:a?(a.id||a.name||a.tagName):'',left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,innerWidth,innerHeight,scrollY,scrollHeight:document.documentElement.scrollHeight};})()`;}
function expressionFor(requestMode,requestArg){
  if(requestMode==='rect-id')return rectBody(`document.getElementById(${JSON.stringify(requestArg)})`);
  if(requestMode==='rect-css')return rectBody(`document.querySelector(${JSON.stringify(requestArg)})`);
  if(requestMode==='rect-text')return rectBody(`[...document.querySelectorAll('button,a,[role="button"]')].find(x=>((x.textContent||'').trim().toLowerCase()).includes(${JSON.stringify(String(requestArg||'').toLowerCase())}))`);
  if(requestMode==='state')return `(()=>{let st=null,cv=null,shift=null,pending=null;try{st=(typeof state!=='undefined'&&state)||null}catch(_e){}try{cv=(typeof currentView!=='undefined')?String(currentView):null}catch(_e){}try{shift=(typeof currentShift==='function')?currentShift():null}catch(_e){}try{pending=window.LP160Stabilization&&LP160Stabilization.getPendingSessionStart?LP160Stabilization.getPendingSessionStart():null}catch(_e){}const active=(st?.sessions||[]).filter(s=>s.status==='active'||s.status==='paused');const paid=(st?.payments||[]);const orders=(st?.orders||[]);const coca=(st?.products||[]).find(p=>p.id==='prod-cocacola');return {currentView:cv,shift:shift?{id:shift.id,status:shift.status,openedAt:shift.openedAt,closedAt:shift.closedAt||null}:null,pending:pending?{stationId:pending.stationId,snackCart:pending.draft?.snackCart||{},customerId:pending.draft?.customerId||null}:null,sessions:(st?.sessions||[]).length,activeSessions:active.length,payments:paid.length,orders:orders.length,paidOrders:orders.filter(o=>String(o.status||'').toLowerCase()==='paid').length,clients:(st?.clients||[]).length,cocaStock:coca==null?null:Number(coca.stock),stations:(st?.stations||[]).length,products:(st?.products||[]).length,viewText:(document.getElementById('view')?.textContent||'').trim().slice(0,600),sheetOpen:document.getElementById('overlay')?.classList.contains('show')||document.getElementById('overlay')?.classList.contains('open')||false,modalOpen:document.getElementById('modalBackdrop')?.classList.contains('show')||document.getElementById('modalBackdrop')?.classList.contains('open')||false,drawerOpen:document.getElementById('drawer')?.classList.contains('show')||document.getElementById('drawer')?.classList.contains('open')||false};})()`;
  throw new Error('unknown mode '+requestMode);
}

let persistentSocket=null;
let socketPageUrl='';
let nextMessageId=1;
let pendingMessages=new Map();
let requestQueue=Promise.resolve();
function dropCdpSession(reason){
  const ws=persistentSocket;
  persistentSocket=null;socketPageUrl='';
  for(const [,pending] of pendingMessages){clearTimeout(pending.timer);pending.reject(new Error(reason||'CDP session invalidated'));}
  pendingMessages.clear();
  if(ws){try{ws.close();}catch(_){}}
}
async function ensureCdpSession(){
  if(persistentSocket&&persistentSocket.readyState===WebSocket.OPEN)return persistentSocket;
  dropCdpSession('reconnecting CDP session');
  repairForward();
  const list=pages();
  const page=list.find(x=>x.type==='page'&&x.webSocketDebuggerUrl)||list.find(x=>x.webSocketDebuggerUrl);
  if(!page)throw new Error('no debuggable WebView page');
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('CDP websocket open timeout')),4500);
    ws.onopen=()=>{clearTimeout(timer);resolve();};
    ws.onerror=()=>{clearTimeout(timer);reject(new Error('CDP websocket open error'));};
  });
  persistentSocket=ws;socketPageUrl=page.webSocketDebuggerUrl;
  ws.onmessage=ev=>{
    let msg;try{msg=JSON.parse(String(ev.data));}catch(_){return;}
    const pending=pendingMessages.get(msg.id);if(!pending)return;
    pendingMessages.delete(msg.id);clearTimeout(pending.timer);
    if(msg.error)return pending.reject(new Error(JSON.stringify(msg.error)));
    if(msg.result&&msg.result.exceptionDetails)return pending.reject(new Error('Runtime exception'));
    pending.resolve(msg.result?.result?.value??null);
  };
  ws.onerror=()=>{if(persistentSocket===ws)dropCdpSession('persistent websocket error');};
  ws.onclose=()=>{if(persistentSocket===ws)dropCdpSession('persistent websocket closed');};
  return ws;
}
async function evaluateReadOnly(requestMode,requestArg){
  let lastError=null;
  for(let attempt=1;attempt<=MAX_ATTEMPTS;attempt++){
    try{
      const ws=await ensureCdpSession();
      const id=nextMessageId++;
      const value=await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{pendingMessages.delete(id);reject(new Error('Runtime.evaluate timeout'));},EVALUATE_TIMEOUT_MS);
        pendingMessages.set(id,{resolve,reject,timer});
        ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression:expressionFor(requestMode,requestArg),returnByValue:true,awaitPromise:true}}));
      });
      return value;
    }catch(e){
      lastError=e;dropCdpSession(e&&e.message?e.message:'CDP evaluate failure');
      if(attempt<MAX_ATTEMPTS)await sleep(220*attempt);
    }
  }
  throw lastError||new Error('CDP probe failed');
}
async function queuedEvaluate(requestMode,requestArg){
  const work=requestQueue.then(()=>evaluateReadOnly(requestMode,requestArg));
  requestQueue=work.catch(()=>{});
  return work;
}
function jsonResponse(res,status,payload){
  const body=JSON.stringify(payload);res.writeHead(status,{'content-type':'application/json','content-length':Buffer.byteLength(body),'connection':'close'});res.end(body);
}
function startDaemon(){
  const server=http.createServer((req,res)=>{
    if(req.method==='GET'&&req.url==='/health')return jsonResponse(res,200,{ok:true,session:!!(persistentSocket&&persistentSocket.readyState===WebSocket.OPEN),page:socketPageUrl||null});
    if(req.method!=='POST'||req.url!=='/probe')return jsonResponse(res,404,{ok:false,error:'not found'});
    let raw='';req.setEncoding('utf8');req.on('data',chunk=>{raw+=chunk;if(raw.length>65536)req.destroy();});
    req.on('end',async()=>{
      try{
        const payload=JSON.parse(raw||'{}');
        const result=await queuedEvaluate(String(payload.mode||''),String(payload.arg||''));
        jsonResponse(res,200,{ok:true,result});
      }catch(e){jsonResponse(res,502,{ok:false,error:e&&e.message?e.message:String(e)});}
    });
  });
  server.listen(DAEMON_PORT,'127.0.0.1');
  const shutdown=()=>{dropCdpSession('daemon shutdown');server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),500).unref();};
  process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
}
function daemonRequest(requestMode,requestArg,timeout=DAEMON_REQUEST_TIMEOUT_MS){
  return new Promise((resolve,reject)=>{
    const body=JSON.stringify({mode:requestMode,arg:requestArg});
    const req=http.request({host:'127.0.0.1',port:DAEMON_PORT,path:'/probe',method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},res=>{
      let raw='';res.setEncoding('utf8');res.on('data',c=>raw+=c);res.on('end',()=>{
        let parsed;try{parsed=JSON.parse(raw||'{}');}catch(e){return reject(new Error('daemon invalid JSON: '+e.message));}
        if(res.statusCode!==200||!parsed.ok)return reject(new Error(parsed.error||`daemon HTTP ${res.statusCode}`));
        resolve(parsed.result);
      });
    });
    req.setTimeout(timeout,()=>req.destroy(new Error('daemon request timeout')));req.on('error',reject);req.end(body);
  });
}
function daemonHealth(timeout=500){
  return new Promise(resolve=>{
    const req=http.get({host:'127.0.0.1',port:DAEMON_PORT,path:'/health'},res=>{res.resume();resolve(res.statusCode===200);});
    req.setTimeout(timeout,()=>{req.destroy();resolve(false);});req.on('error',()=>resolve(false));
  });
}
async function ensureDaemon(){
  if(await daemonHealth())return;
  const child=spawn(process.execPath,[__filename,'--daemon'],{detached:true,stdio:'ignore',env:process.env});child.unref();
  for(let attempt=1;attempt<=20;attempt++){if(await daemonHealth())return;await sleep(100);}
  throw new Error('persistent CDP daemon did not start');
}
async function clientMain(){
  if(!mode)throw new Error('missing mode');
  await ensureDaemon();
  return daemonRequest(mode,arg);
}
if(IS_DAEMON)startDaemon();
else clientMain().then(result=>process.stdout.write(JSON.stringify(result))).catch(e=>fail(e&&e.message?e.message:String(e)));
