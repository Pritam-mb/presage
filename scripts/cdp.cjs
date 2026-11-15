// Minimal local WebSocket transport for Chromium DevTools, without npm dependencies.
const net=require('node:net');const crypto=require('node:crypto');
function connect(url,onMessage){
  const address=new URL(url),key=crypto.randomBytes(16).toString('base64');
  return new Promise((resolve,reject)=>{
    const socket=net.connect(Number(address.port),address.hostname);let buffer=Buffer.alloc(0),handshaken=false;
    function sendFrame(data,opcode=1){const body=Buffer.from(data),mask=crypto.randomBytes(4);let head;
      if(body.length<126){head=Buffer.from([0x80|opcode,0x80|body.length]);}
      else if(body.length<65536){head=Buffer.alloc(4);head[0]=0x80|opcode;head[1]=0xfe;head.writeUInt16BE(body.length,2);}
      else{head=Buffer.alloc(10);head[0]=0x80|opcode;head[1]=0xff;head.writeBigUInt64BE(BigInt(body.length),2);}
      const masked=Buffer.alloc(body.length);for(let i=0;i<body.length;i++)masked[i]=body[i]^mask[i%4];socket.write(Buffer.concat([head,mask,masked]));
    }
    const transport={send:text=>sendFrame(text),close:()=>socket.destroy()};let fragments=[];
    socket.on('connect',()=>socket.write(`GET ${address.pathname}${address.search} HTTP/1.1\r\nHost: ${address.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`));
    socket.on('error',reject);
    socket.on('data',chunk=>{
      buffer=Buffer.concat([buffer,chunk]);
      if(!handshaken){const boundary=buffer.indexOf('\r\n\r\n');if(boundary<0)return;const header=buffer.subarray(0,boundary).toString();
        const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
        if(!header.startsWith('HTTP/1.1 101')||!header.toLowerCase().includes(accept.toLowerCase())){reject(new Error('WebSocket handshake rejected: '+header));socket.destroy();return;}
        buffer=buffer.subarray(boundary+4);handshaken=true;resolve(transport);
      }
      while(buffer.length>=2){const opcode=buffer[0]&15,fin=!!(buffer[0]&128),masked=!!(buffer[1]&128);let length=buffer[1]&127,offset=2;
        if(length===126){if(buffer.length<4)return;length=buffer.readUInt16BE(2);offset=4;}
        else if(length===127){if(buffer.length<10)return;length=Number(buffer.readBigUInt64BE(2));offset=10;}
        if(length>50_000_000){socket.destroy();return;}
        const mask=masked?buffer.subarray(offset,offset+4):null;if(masked)offset+=4;
        if(buffer.length<offset+length)return;let body=Buffer.from(buffer.subarray(offset,offset+length));buffer=buffer.subarray(offset+length);
        if(mask)for(let i=0;i<body.length;i++)body[i]^=mask[i%4];
        if(opcode===8){socket.destroy();return;}if(opcode===9){sendFrame(body,10);continue;}
        if(opcode===1||opcode===0){fragments.push(body);if(fin){const text=Buffer.concat(fragments).toString();fragments=[];onMessage(JSON.parse(text));}}
      }
    });
  });
}
module.exports={connect};
