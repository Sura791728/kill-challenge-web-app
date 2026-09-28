const encoder = new TextEncoder();

function bytes(hex:string):Uint8Array<ArrayBuffer>|null {
  if(!/^[0-9a-f]{64}$/i.test(hex))return null;
  const result=new Uint8Array(new ArrayBuffer(32));
  for(let index=0;index<32;index++)result[index]=parseInt(hex.slice(index*2,index*2+2),16);
  return result;
}

export async function verifiedProxyIp(request:Request,secret:string|undefined):Promise<string|null> {
  if(!secret)return null;
  const ip=request.headers.get('X-KC-Proxy-IP');
  const time=request.headers.get('X-KC-Proxy-Time');
  const signature=bytes(request.headers.get('X-KC-Proxy-Signature')??'');
  if(!ip||!/^[0-9a-f:.]{3,64}$/i.test(ip)||!time||!/^\d{13}$/.test(time)||!signature)return null;
  if(Math.abs(Date.now()-Number(time))>60_000)return null;
  const url=new URL(request.url);
  const message=`${time}\n${ip}\n${request.method}\n${url.pathname}${url.search}`;
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  return await crypto.subtle.verify('HMAC',key,signature,encoder.encode(message))?ip:null;
}
