const UPSTREAM = new URL('https://valorant-kill-challenge-control.blue-sloth-0287.chatgpt.site');

export async function proxyRequest(request, upstreamFetch = fetch) {
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
  fetch(request) {
    return proxyRequest(request);
  }
};
