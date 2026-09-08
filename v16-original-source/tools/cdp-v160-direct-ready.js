'use strict';
/* Lightweight API33 transport readiness check.
 * IMPORTANT: this helper MUST NOT call Runtime.evaluate. Native #133 proved that even a tiny
 * preflight Runtime.evaluate can stall the fresh API33 emulator before FRESH_STATE.
 * The authoritative WebView-JS readiness proof remains the first `probe state` snapshot.
 */
const http=require('http');
const port=Number(process.env.LP160_CDP_PORT||9229);

function discover(timeout=1200){
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
  process.stdout.write(page?'true':'false');
  if(!page)process.exitCode=2;
})().catch(()=>{process.stdout.write('false');process.exitCode=2;});
