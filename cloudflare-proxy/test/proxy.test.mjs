import assert from 'node:assert/strict';
import {test} from 'node:test';
import {proxyRequest} from '../src/index.mjs';

const publicUrl='https://kill-challenge-web-app.example.workers.dev';
const upstreamUrl='https://valorant-kill-challenge-control.blue-sloth-0287.chatgpt.site';

test('forwards body, cookies, and same-origin headers',async()=>{
  const request=new Request(`${publicUrl}/api/auth?game=apex`,{
    method:'POST',duplex:'half',body:JSON.stringify({kind:'login'}),
    headers:{Origin:publicUrl,Referer:`${publicUrl}/`,Cookie:'__Host-kc_session=sample',
      'CF-Connecting-IP':'203.0.113.29','X-KC-Proxy-IP':'spoofed',
      'Content-Type':'application/json'}
  });
  let forwarded;
  const response=await proxyRequest(request,async req=>{
    forwarded=req;
    assert.equal(await req.text(),'{"kind":"login"}');
    return new Response('{"ok":true}',{headers:{'Set-Cookie':'__Host-kc_session=token; Path=/; Secure; HttpOnly'}});
  });
  assert.equal(forwarded.url,`${upstreamUrl}/api/auth?game=apex`);
  assert.equal(forwarded.headers.get('Origin'),upstreamUrl);
  assert.equal(forwarded.headers.get('Referer'),`${upstreamUrl}/`);
  assert.equal(forwarded.headers.get('Cookie'),'__Host-kc_session=sample');
  assert.equal(forwarded.headers.get('X-KC-Proxy-IP'),null);
  assert.match(response.headers.get('Set-Cookie'),/__Host-kc_session=token/);
  assert.equal(response.headers.get('Cache-Control'),'no-store');
});

test('strips spoofed forwarding headers and preserves a cross-site Origin',async()=>{
  const request=new Request(`${publicUrl}/api/auth`,{
    method:'POST',body:'{}',duplex:'half',
    headers:{Origin:'https://attacker.example','CF-Connecting-IP':'2001:db8::2',
      'X-KC-Proxy-IP':'192.0.2.1','X-KC-Proxy-Time':'1234567890123','X-KC-Proxy-Signature':'a'.repeat(64)}
  });
  await proxyRequest(request,async req=>{
    assert.equal(req.headers.get('Origin'),'https://attacker.example');
    assert.equal(req.headers.get('X-KC-Proxy-IP'),null);
    assert.equal(req.headers.get('X-KC-Proxy-Time'),null);
    assert.equal(req.headers.get('X-KC-Proxy-Signature'),null);
    return new Response('blocked',{status:403});
  });
});

test('rewrites upstream redirects',async()=>{
  const request=new Request(`${publicUrl}/sign-in`);
  const redirected=await proxyRequest(request,async()=>new Response(null,{
    status:302,headers:{Location:`${upstreamUrl}/dashboard?game=valorant`}
  }));
  assert.equal(redirected.headers.get('Location'),`${publicUrl}/dashboard?game=valorant`);
});
