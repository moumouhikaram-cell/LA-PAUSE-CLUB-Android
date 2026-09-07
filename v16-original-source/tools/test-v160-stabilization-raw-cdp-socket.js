'use strict';
/* Regression from native #49/#50.
 * #49 proved a second Runtime.evaluate through Node's global WebSocket stalled.
 * #50 proved closing that socket then opening another one stalled too.
 * The replacement transport must therefore prove two sequential CDP requests over ONE raw RFC6455
 * connection before it is trusted by the Android journey.
 */
const net=require('net');
const crypto=require('crypto');
const path=require('path');
const {RawCdpWebSocket}=require(path.resolve(__dirname,'cdp-v160-raw-websocket.js'));

function fail(msg){console.error('V160_RAW_CDP_SOCKET_FAIL '+msg);process.exitCode=1;}
function frame(payload){
  const body=Buffer.from(JSON.stringify(payload));
  if(body.length<126)return Buffer.concat([Buffer.from([0x81,body.length]),body]);
  const head=Buffer.alloc(4);head[0]=0x81;head[1]=126;head.writeUInt16BE(body.length,2);return Buffer.concat([head,body]);
}
function consumeClientFrames(state,chunk,onJson){
  state.buf=Buffer.concat([state.buf,chunk]);
  while(state.buf.length>=2){
    const b0=state.buf[0],b1=state.buf[1];
    let len=b1&0x7f,off=2;
    if(len===126){if(state.buf.length<4)return;len=state.buf.readUInt16BE(2);off=4;}
    else if(len===127){if(state.buf.length<10)return;const n=Number(state.buf.readBigUInt64BE(2));if(!Number.isSafeInteger(n))throw new Error('oversized frame');len=n;off=10;}
    const masked=!!(b1&0x80);if(!masked)throw new Error('client frame must be masked');
    if(state.buf.length<off+4+len)return;
    const mask=state.buf.subarray(off,off+4);off+=4;
    const body=Buffer.from(state.buf.subarray(off,off+len));
    for(let i=0;i<body.length;i++)body[i]^=mask[i&3];
    state.buf=state.buf.subarray(off+len);
    const opcode=b0&0x0f;
    if(opcode===8)return;
    if(opcode!==1)continue;
    onJson(JSON.parse(body.toString('utf8')));
  }
}

(async()=>{
  let connections=0,requests=0;
  const server=net.createServer(socket=>{
    connections++;
    let handshaken=false;
    let header=Buffer.alloc(0);
    const state={buf:Buffer.alloc(0)};
    socket.on('data',chunk=>{
      if(!handshaken){
        header=Buffer.concat([header,chunk]);
        const end=header.indexOf('\r\n\r\n');if(end<0)return;
        const text=header.subarray(0,end+4).toString('utf8');
        const key=(text.match(/Sec-WebSocket-Key:\s*([^\r\n]+)/i)||[])[1];
        if(!key)throw new Error('missing websocket key');
        const accept=crypto.createHash('sha1').update(key.trim()+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
        socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
        handshaken=true;
        const rest=header.subarray(end+4);header=Buffer.alloc(0);
        if(rest.length)consumeClientFrames(state,rest,onJson);
        return;
      }
      consumeClientFrames(state,chunk,onJson);
    });
    function onJson(msg){
      requests++;
      socket.write(frame({id:msg.id,result:{result:{value:'reply-'+msg.id}}}));
    }
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const addr=server.address();
  let ws;
  try{
    ws=await RawCdpWebSocket.connect(`ws://127.0.0.1:${addr.port}/devtools/page/test`,1500);
    const one=await ws.request({id:1,method:'Runtime.evaluate',params:{expression:'1',returnByValue:true}},1500);
    const two=await ws.request({id:2,method:'Runtime.evaluate',params:{expression:'2',returnByValue:true}},1500);
    if(one?.result?.result?.value!=='reply-1')throw new Error('first response mismatch');
    if(two?.result?.result?.value!=='reply-2')throw new Error('second response mismatch');
    if(connections!==1)throw new Error(`expected one connection, got ${connections}`);
    if(requests!==2)throw new Error(`expected two requests, got ${requests}`);
    console.log('V160_RAW_CDP_SEQUENTIAL_REQUESTS_OK connections=1 requests=2');
  }catch(e){
    fail(e&&e.stack?e.stack:String(e));
  }finally{
    if(ws)ws.destroy();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(e=>fail(e&&e.stack?e.stack:String(e)));
