import assert from 'node:assert/strict';
import {test} from 'node:test';
import {proxyRequest} from '../src/index.mjs';
import {verifiedProxyIp} from '../../lib/proxy-ip.ts';

const publicUrl='https://kill-challenge-web-app.example.workers.dev';
const upstreamUrl='https://valorant-kill-challenge-control.blue-sloth-0287.chatgpt.site';
const secret='test-secret-keep-private';

test('forwards a signed client IP, body, cookies, and same-origin headers',async()=>{
  const request=new Request(`${publicUrl}/api/auth?game=apex`,{
    method:'POST',duplex:'half',body:JSON.stringify({kind:'login'}),
    headers:{Origin:publicUrl,Referer:`${publicUrl}/`,Cookie:'__Host-kc_session=sample',
      'CF-Connecting-IP':'203.0.113.29','X-KC-Proxy-IP':'spoofed',
      'Content-Type':'application/json'}
  });
  let forwarded;
  const response=await proxyRequest(request,{PROXY_SECRET:secret},async req=>{
    forwarded=req;
    assert.equal(await req.text(),'{"kind":"login"}');
    return new Response('{"ok":true}',{headers:{'Set-Cookie':'__Host-kc_session=token; Path=/; Secure; HttpOnly'}});
  });
  assert.equal(forwarded.url,`${upstreamUrl}/api/auth?game=apex`);
  assert.equal(forwarded.headers.get('Origin'),upstreamUrl);
  assert.equal(forwarded.headers.get('Referer'),`${upstreamUrl}/`);
  assert.equal(forwarded.headers.get('Cookie'),'__Host-kc_session=sample');
  assert.equal(await verifiedProxyIp(forwarded,secret),'203.0.113.29');
  assert.match(response.headers.get('Set-Cookie'),/__Host-kc_session=token/);
  assert.equal(response.headers.get('Cache-Control'),'no-store');
});

test('cannot spoof the client IP or a cross-site Origin',async()=>{
  const request=new Request(`${publicUrl}/api/auth`,{
    method:'POST',body:'{}',duplex:'half',
    headers:{Origin:'https://attacker.example','CF-Connecting-IP':'2001:db8::2',
      'X-KC-Proxy-IP':'192.0.2.1','X-KC-Proxy-Time':'1234567890123','X-KC-Proxy-Signature':'a'.repeat(64)}
  });
  await proxyRequest(request,{PROXY_SECRET:secret},async req=>{
    assert.equal(req.headers.get('Origin'),'https://attacker.example');
    assert.equal(await verifiedProxyIp(req,secret),'2001:db8::2');
    const tampered=new Request(`${upstreamUrl}/api/other`,req);
    assert.equal(await verifiedProxyIp(tampered,secret),null);
    return new Response('blocked',{status:403});
  });
});

test('rewrites upstream redirects and requires a configured secret',async()=>{
  const request=new Request(`${publicUrl}/sign-in`);
  const unavailable=await proxyRequest(request,{},async()=>{throw Error('should not fetch');});
  assert.equal(unavailable.status,503);
  const redirected=await proxyRequest(request,{PROXY_SECRET:secret},async()=>new Response(null,{
    status:302,headers:{Location:`${upstreamUrl}/dashboard?game=valorant`}
  }));
  assert.equal(redirected.headers.get('Location'),`${publicUrl}/dashboard?game=valorant`);
});
