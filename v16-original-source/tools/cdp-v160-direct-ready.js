'use strict';
/* Lightweight API33 readiness check.
 * The authoritative business snapshot remains `probe state`; this helper only proves
 * that the forwarded WebView accepts one tiny Runtime.evaluate before FRESH_STATE.
 */
const http=require('http');
const {RawCdpWebSocket}=require('./cdp-v160-raw-websocket');
const port=Number(process.env.LP160_CDP_PORT||9229);

function discover(timeout=1400){
  return new Promise((resolve,reject)=>{
    const req=http.get({host:'127.0.0.1',port,path:'/json'},res=>{
      let raw='';
      res.setEncoding('utf8');
      res.on('data',c=>{raw+=c;if(raw.length>2*1024*1024)req.destroy(new Error('CDP discovery too large'));});
      res.on('end',()=>{
        if(res.statusCode!==200)return reject(new Error(`CDP discovery HTTP ${res.statusCode}`));
        try{const parsed=JSON.parse(raw||'[]');resolve(Array.isArray(parsed)?parsed:[]);}catch(e){reject(e);}
      });
    });
    req.setTimeout(timeout,()=>req.destroy(new Error('CDP discovery timeout')));
    req.on('error',reject);
  });
}

(async()=>{
  const pages=await discover();
  const page=pages.find(x=>x&&x.type==='page'&&x.webSocketDebuggerUrl)||pages.find(x=>x&&x.webSocketDebuggerUrl);
  if(!page)throw new Error('no debuggable WebView page');
  const ws=await RawCdpWebSocket.connect(page.webSocketDebuggerUrl,1800);
  try{
    const response=await ws.request({id:1,method:'Runtime.evaluate',params:{expression:"(()=>document.readyState==='complete'&&!!document.getElementById('view'))()",returnByValue:true,awaitPromise:true}},1800);
    if(response&&response.error)throw new Error(JSON.stringify(response.error));
    if(response?.result?.exceptionDetails)throw new Error('Runtime exception');
    process.stdout.write(response?.result?.result?.value===true?'true':'false');
  }finally{
    ws.destroy();
  }
})().catch(()=>{process.stdout.write('false');process.exitCode=2;});
