'use strict';
/* Read-only CDP snapshot for the historical v1.6 WebView.
 * No clicks, focus, typing, storage writes, navigation, or render calls.
 */
const port=Number(process.env.LP160_CDP_PORT||9228);
function fail(msg){console.error('V160_CDP_PROBE_FAIL '+msg);process.exit(2);}
async function pages(){const r=await fetch(`http://127.0.0.1:${port}/json`);if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}
const expr=`(()=>{
  const v=document.getElementById('view');
  const vr=v?v.getBoundingClientRect():null;
  const vs=v?getComputedStyle(v):null;
  const visible=[];
  if(v){
    for(const e of [...v.querySelectorAll('*')]){
      const r=e.getBoundingClientRect(),s=getComputedStyle(e);
      if(r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0){
        visible.push({tag:e.tagName,id:e.id||'',cls:String(e.className||'').slice(0,100),text:(e.textContent||'').trim().slice(0,100),top:r.top,bottom:r.bottom,left:r.left,right:r.right});
        if(visible.length>=12)break;
      }
    }
  }
  let current=null,stateView=null,stations=null,sessions=null,isLocked=null;
  try{current=(typeof currentView!=='undefined')?String(currentView):null}catch(_e){}
  try{stateView=(typeof state!=='undefined'&&state&&state.ui)?String(state.ui.currentView||''):null;stations=(typeof state!=='undefined'&&state&&Array.isArray(state.stations))?state.stations.length:null;sessions=(typeof state!=='undefined'&&state&&Array.isArray(state.sessions))?state.sessions.length:null}catch(_e){}
  try{isLocked=(typeof locked!=='undefined')?!!locked:null}catch(_e){}
  const x=window.LP160||null;
  let modules=[],health=null;
  try{modules=x&&x.modules?[...x.modules.keys()]:[]}catch(_e){}
  try{health=x&&x.core&&typeof x.core.enrichmentHealth==='function'?x.core.enrichmentHealth():null}catch(e){health={probeError:String(e&&e.message||e)}}
  const center=vr?document.elementFromPoint(Math.max(0,Math.min(innerWidth-1,(vr.left+vr.right)/2)),Math.max(0,Math.min(innerHeight-1,(vr.top+Math.min(vr.bottom,innerHeight))/2))):null;
  return {
    readyState:document.readyState,url:location.href,title:document.title,
    currentView:current,stateView,stations,sessions,locked:isLocked,
    renderViewType:typeof window.renderView,renderFloorType:typeof window.renderFloor,
    viewExists:!!v,viewChildCount:v?v.children.length:0,viewHtmlLength:v?v.innerHTML.length:0,viewText:(v?.textContent||'').trim().slice(0,500),
    viewRect:vr?{left:vr.left,top:vr.top,right:vr.right,bottom:vr.bottom,width:vr.width,height:vr.height}:null,
    viewStyle:vs?{display:vs.display,visibility:vs.visibility,opacity:vs.opacity,overflowY:vs.overflowY,backgroundColor:vs.backgroundColor}:null,
    visibleSample:visible,
    centerHit:center?{tag:center.tagName,id:center.id||'',cls:String(center.className||'').slice(0,100),text:(center.textContent||'').trim().slice(0,120)}:null,
    lp160:!!x,modules,health,
    scripts:[...document.scripts].map(s=>(s.getAttribute('src')||'inline')).slice(-30)
  };
})()`;
async function main(){
  const list=await pages();
  const page=list.find(x=>x.type==='page'&&x.webSocketDebuggerUrl)||list.find(x=>x.webSocketDebuggerUrl);
  if(!page)fail('no debuggable WebView page');
  const ws=new WebSocket(page.webSocketDebuggerUrl),id=1;
  const value=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('timeout')),7000);
    ws.onopen=()=>ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression:expr,returnByValue:true,awaitPromise:true}}));
    ws.onerror=()=>{clearTimeout(timer);reject(new Error('websocket error'));};
    ws.onmessage=ev=>{let m;try{m=JSON.parse(String(ev.data));}catch(_e){return;}if(m.id!==id)return;clearTimeout(timer);if(m.error)return reject(new Error(JSON.stringify(m.error)));if(m.result&&m.result.exceptionDetails)return reject(new Error('runtime exception'));resolve(m.result?.result?.value??null);};
  });
  try{ws.close();}catch(_e){}
  process.stdout.write(JSON.stringify(value));
}
main().catch(e=>fail(e&&e.message?e.message:String(e)));
