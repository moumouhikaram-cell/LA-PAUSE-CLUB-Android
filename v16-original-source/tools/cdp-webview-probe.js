'use strict';
/* Read-only Chrome DevTools Protocol probe for the debug Android WebView.
   It never clicks, focuses, types, or changes application state. It only returns
   DOM geometry/state so the smoke test can perform the actual interaction with
   adb input tap / adb input text. */
const mode=process.argv[2]||'';
const arg=process.argv.slice(3).join(' ');
const port=Number(process.env.LPOS_CDP_PORT||9222);

function fail(msg){console.error('CDP_PROBE_FAIL '+msg);process.exit(2);}
async function pages(){
  const r=await fetch(`http://127.0.0.1:${port}/json`);
  if(!r.ok)throw new Error('HTTP '+r.status);
  return r.json();
}
function expression(){
  if(mode==='rect-id'){
    return `(()=>{const e=document.getElementById(${JSON.stringify(arg)});if(!e)return null;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {id:e.id,tag:e.tagName,type:e.type||'',disabled:!!e.disabled,readOnly:!!e.readOnly,pointerEvents:s.pointerEvents,display:s.display,visibility:s.visibility,opacity:s.opacity,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,innerWidth:innerWidth,innerHeight:innerHeight,dpr:devicePixelRatio,active:document.activeElement===e};})()`;
  }
  if(mode==='rect-text'){
    return `(()=>{const q=${JSON.stringify(arg.toLowerCase())};const all=[...document.querySelectorAll('button,a,[role="button"]')];const e=all.find(x=>((x.textContent||'').trim().toLowerCase()).includes(q));if(!e)return null;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,text:(e.textContent||'').trim(),disabled:!!e.disabled,pointerEvents:s.pointerEvents,display:s.display,visibility:s.visibility,opacity:s.opacity,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,innerWidth:innerWidth,innerHeight:innerHeight,dpr:devicePixelRatio};})()`;
  }
  if(mode==='audit'){
    return `(()=>{const sel='button,a[href],[role="button"],[data-go],[data-action],[data-v291],[data-v294],[data-v296],[data-v299],.tab,.canon-tabs button,input,textarea,select';const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0};const a=[...document.querySelectorAll(sel)].filter(vis);return {screen:Number((window.LPOS&&LPOS.state&&LPOS.state.ui&&LPOS.state.ui.screen)||0),count:a.length,forms:a.filter(e=>/^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName)).map(e=>({id:e.id,tag:e.tagName,disabled:!!e.disabled,readOnly:!!e.readOnly,pointerEvents:getComputedStyle(e).pointerEvents})),controls:a.filter(e=>!/^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName)).map(e=>({tag:e.tagName,text:(e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,80),disabled:!!e.disabled,go:e.getAttribute('data-go'),action:e.getAttribute('data-action'),v291:e.getAttribute('data-v291'),v294:e.getAttribute('data-v294'),v296:e.getAttribute('data-v296'),v299:e.getAttribute('data-v299'),pointerEvents:getComputedStyle(e).pointerEvents}))};})()`;
  }
  fail('unknown mode '+mode);
}
async function main(){
  const list=await pages();
  const page=list.find(x=>x.type==='page'&&x.webSocketDebuggerUrl)||list.find(x=>x.webSocketDebuggerUrl);
  if(!page)fail('no debuggable WebView page');
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  const id=1;
  const result=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('timeout')),7000);
    ws.onopen=()=>ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression:expression(),returnByValue:true,awaitPromise:true}}));
    ws.onerror=e=>{clearTimeout(timer);reject(new Error('websocket error'));};
    ws.onmessage=ev=>{
      let m;try{m=JSON.parse(String(ev.data));}catch(_e){return;}
      if(m.id!==id)return;
      clearTimeout(timer);
      if(m.error)return reject(new Error(JSON.stringify(m.error)));
      if(m.result&&m.result.exceptionDetails)return reject(new Error('Runtime exception'));
      resolve(m.result&&m.result.result?m.result.result.value:null);
    };
  });
  try{ws.close();}catch(_e){}
  process.stdout.write(JSON.stringify(result));
}
main().catch(e=>fail(e&&e.message?e.message:String(e)));
