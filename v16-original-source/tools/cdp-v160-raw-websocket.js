'use strict';
/* Minimal dependency-free RFC6455 client for the read-only Android WebView CDP probe.
 * It intentionally supports only ws:// targets, masked client frames, text JSON messages,
 * ping/pong, close, fragmentation, and request correlation by CDP id.
 */
const net=require('net');
const crypto=require('crypto');

const MAGIC='258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function makeClientFrame(opcode,payload){
  const body=Buffer.isBuffer(payload)?payload:Buffer.from(payload||'');
  const mask=crypto.randomBytes(4);
  let head;
  if(body.length<126){
    head=Buffer.alloc(2);head[0]=0x80|(opcode&0x0f);head[1]=0x80|body.length;
  }else if(body.length<=0xffff){
    head=Buffer.alloc(4);head[0]=0x80|(opcode&0x0f);head[1]=0x80|126;head.writeUInt16BE(body.length,2);
  }else{
    head=Buffer.alloc(10);head[0]=0x80|(opcode&0x0f);head[1]=0x80|127;head.writeBigUInt64BE(BigInt(body.length),2);
  }
  const masked=Buffer.alloc(body.length);
  for(let i=0;i<body.length;i++)masked[i]=body[i]^mask[i&3];
  return Buffer.concat([head,mask,masked]);
}

class RawCdpWebSocket{
  constructor(socket){
    this.socket=socket;
    this.buffer=Buffer.alloc(0);
    this.pending=new Map();
    this.closed=false;
    this.fragmentOpcode=0;
    this.fragments=[];
    this.transportStats={
      createdAt:Date.now(),
      requestsSent:0,
      responsesReceived:0,
      eventsReceived:0,
      framesReceived:0,
      bytesReceived:0,
      bytesSent:0,
      lastRequestId:null,
      lastResponseId:null,
      lastRequestAt:null,
      lastResponseAt:null,
      lastReceiveAt:null
    };
    socket.on('data',chunk=>this._onData(chunk));
    socket.on('error',err=>this._failAll(err));
    socket.on('close',()=>this._failAll(new Error('raw websocket closed')));
  }

  static connect(urlText,timeout=4500){
    return new Promise((resolve,reject)=>{
      let url;
      try{url=new URL(urlText);}catch(e){reject(e);return;}
      if(url.protocol!=='ws:'){reject(new Error('raw CDP websocket supports ws:// only'));return;}
      const host=url.hostname;
      const port=Number(url.port||80);
      const key=crypto.randomBytes(16).toString('base64');
      const expected=crypto.createHash('sha1').update(key+MAGIC).digest('base64');
      const socket=net.createConnection({host,port});
      let settled=false;
      let handshake=Buffer.alloc(0);
      const timer=setTimeout(()=>finish(new Error('CDP raw websocket open timeout')),timeout);
      const finish=(err,client)=>{
        if(settled)return;settled=true;clearTimeout(timer);
        socket.removeListener('connect',onConnect);
        socket.removeListener('data',onHandshakeData);
        socket.removeListener('error',onHandshakeError);
        if(err){try{socket.destroy();}catch(_){}reject(err);}else resolve(client);
      };
      const onHandshakeError=err=>finish(err);
      const onConnect=()=>{
        const path=(url.pathname||'/')+(url.search||'');
        const hostHeader=url.port?`${host}:${port}`:host;
        const request=[
          `GET ${path} HTTP/1.1`,
          `Host: ${hostHeader}`,
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Key: ${key}`,
          'Sec-WebSocket-Version: 13',
          '\r\n'
        ].join('\r\n');
        socket.write(request);
      };
      const onHandshakeData=chunk=>{
        handshake=Buffer.concat([handshake,chunk]);
        const end=handshake.indexOf('\r\n\r\n');
        if(end<0){if(handshake.length>65536)finish(new Error('CDP raw websocket handshake too large'));return;}
        const text=handshake.subarray(0,end+4).toString('utf8');
        const status=(text.match(/^HTTP\/1\.[01]\s+(\d+)/i)||[])[1];
        const accept=(text.match(/Sec-WebSocket-Accept:\s*([^\r\n]+)/i)||[])[1];
        if(status!=='101')return finish(new Error(`CDP raw websocket handshake HTTP ${status||'unknown'}`));
        if(!accept||accept.trim()!==expected)return finish(new Error('CDP raw websocket accept mismatch'));
        const client=new RawCdpWebSocket(socket);
        const rest=handshake.subarray(end+4);
        if(rest.length)client._onData(rest);
        finish(null,client);
      };
      socket.once('connect',onConnect);
      socket.on('data',onHandshakeData);
      socket.once('error',onHandshakeError);
    });
  }

  isOpen(){return !this.closed&&!!this.socket&&!this.socket.destroyed&&this.socket.writable;}

  diagnostics(){
    return {
      ...this.transportStats,
      open:this.isOpen(),
      closed:this.closed,
      pendingIds:[...this.pending.keys()],
      bufferedBytes:this.buffer.length,
      fragmentOpcode:this.fragmentOpcode,
      fragmentCount:this.fragments.length
    };
  }

  request(message,timeout=4500){
    return new Promise((resolve,reject)=>{
      if(!this.isOpen())return reject(new Error('raw websocket not open'));
      const id=message&&message.id;
      if(id==null)return reject(new Error('CDP request id missing'));
      if(this.pending.has(id))return reject(new Error(`duplicate CDP request id ${id}`));
      const timer=setTimeout(()=>{
        this.pending.delete(id);
        reject(new Error('Runtime.evaluate timeout'));
      },timeout);
      this.pending.set(id,{resolve,reject,timer});
      try{
        const frame=makeClientFrame(1,Buffer.from(JSON.stringify(message)));
        this.socket.write(frame);
        this.transportStats.requestsSent++;
        this.transportStats.bytesSent+=frame.length;
        this.transportStats.lastRequestId=id;
        this.transportStats.lastRequestAt=Date.now();
      }catch(e){clearTimeout(timer);this.pending.delete(id);reject(e);}
    });
  }

  destroy(){
    if(this.closed)return;
    this.closed=true;
    this._rejectPending(new Error('raw websocket destroyed'));
    try{this.socket.destroy();}catch(_){}
  }

  _rejectPending(err){
    for(const [,p] of this.pending){clearTimeout(p.timer);p.reject(err);}
    this.pending.clear();
  }

  _failAll(err){
    if(this.closed)return;
    this.closed=true;
    this._rejectPending(err instanceof Error?err:new Error(String(err)));
    try{this.socket.destroy();}catch(_){}
  }

  _onData(chunk){
    if(this.closed)return;
    this.transportStats.bytesReceived+=chunk.length;
    this.transportStats.lastReceiveAt=Date.now();
    this.buffer=Buffer.concat([this.buffer,chunk]);
    try{
      while(this.buffer.length>=2){
        const b0=this.buffer[0],b1=this.buffer[1];
        const fin=!!(b0&0x80),opcode=b0&0x0f,masked=!!(b1&0x80);
        let len=b1&0x7f,off=2;
        if(len===126){if(this.buffer.length<4)return;len=this.buffer.readUInt16BE(2);off=4;}
        else if(len===127){
          if(this.buffer.length<10)return;
          const n=this.buffer.readBigUInt64BE(2);if(n>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('raw websocket frame too large');
          len=Number(n);off=10;
        }
        let mask=null;
        if(masked){if(this.buffer.length<off+4)return;mask=this.buffer.subarray(off,off+4);off+=4;}
        if(this.buffer.length<off+len)return;
        const payload=Buffer.from(this.buffer.subarray(off,off+len));
        this.buffer=this.buffer.subarray(off+len);
        if(mask)for(let i=0;i<payload.length;i++)payload[i]^=mask[i&3];
        this.transportStats.framesReceived++;
        this._handleFrame(opcode,fin,payload);
        if(this.closed)return;
      }
    }catch(e){this._failAll(e);}
  }

  _handleFrame(opcode,fin,payload){
    if(opcode===8){this._failAll(new Error('raw websocket peer closed'));return;}
    if(opcode===9){
      if(this.isOpen()){
        const frame=makeClientFrame(10,payload);
        this.socket.write(frame);
        this.transportStats.bytesSent+=frame.length;
      }
      return;
    }
    if(opcode===10)return;
    if(opcode===0){
      if(!this.fragmentOpcode)throw new Error('unexpected continuation frame');
      this.fragments.push(payload);
      if(fin){const op=this.fragmentOpcode,body=Buffer.concat(this.fragments);this.fragmentOpcode=0;this.fragments=[];this._handleMessage(op,body);}
      return;
    }
    if(opcode!==1&&opcode!==2)return;
    if(!fin){this.fragmentOpcode=opcode;this.fragments=[payload];return;}
    this._handleMessage(opcode,payload);
  }

  _handleMessage(opcode,payload){
    if(opcode!==1)return;
    let msg;
    try{msg=JSON.parse(payload.toString('utf8'));}catch(_){return;}
    if(msg==null)return;
    if(msg.id==null){this.transportStats.eventsReceived++;return;}
    this.transportStats.responsesReceived++;
    this.transportStats.lastResponseId=msg.id;
    this.transportStats.lastResponseAt=Date.now();
    const p=this.pending.get(msg.id);if(!p)return;
    this.pending.delete(msg.id);clearTimeout(p.timer);p.resolve(msg);
  }
}

module.exports={RawCdpWebSocket,makeClientFrame};
