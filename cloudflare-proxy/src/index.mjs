const UPSTREAM = new URL('https://valorant-kill-challenge-control.blue-sloth-0287.chatgpt.site');
const encoder = new TextEncoder();

async function signature(secret, message) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

export async function proxyRequest(request, env, upstreamFetch = fetch) {
  if (!env.PROXY_SECRET) return new Response('設定が完了していません', { status: 503 });
  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, UPSTREAM);
  const headers = new Headers(request.headers);
  for (const name of ['Host', 'X-KC-Proxy-IP', 'X-KC-Proxy-Time', 'X-KC-Proxy-Signature', 'X-Forwarded-Host']) headers.delete(name);
  if (headers.get('Origin') === incoming.origin) headers.set('Origin', UPSTREAM.origin);
  const referer = headers.get('Referer');
  if (referer) {
    try {
      if (new URL(referer).origin === incoming.origin) {
        headers.set('Referer', UPSTREAM.origin + referer.slice(incoming.origin.length));
      }
    } catch { /* Pass an invalid referer through to the upstream. */ }
  }
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip && /^[0-9a-f:.]{3,64}$/i.test(ip)) {
    const time = String(Date.now());
    const message = `${time}\n${ip}\n${request.method}\n${target.pathname}${target.search}`;
    headers.set('X-KC-Proxy-IP', ip);
    headers.set('X-KC-Proxy-Time', time);
    headers.set('X-KC-Proxy-Signature', await signature(env.PROXY_SECRET, message));
  }
  const init = { method: request.method, headers, body: request.body, redirect: 'manual' };
  if (request.body) init.duplex = 'half';
  const upstream = await upstreamFetch(new Request(target, init));
  const responseHeaders = new Headers(upstream.headers);
  const location = responseHeaders.get('Location');
  if (location) {
    const destination = new URL(location, UPSTREAM);
    if (destination.origin === UPSTREAM.origin) {
      responseHeaders.set('Location', incoming.origin + destination.pathname + destination.search + destination.hash);
    }
  }
  responseHeaders.set('Cache-Control', 'no-store');
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
}

export default {
  fetch(request, env) {
    return proxyRequest(request, env);
  }
};
