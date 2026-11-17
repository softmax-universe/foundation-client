import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { BrowserIdentity } from '@softmax-universe/identity-client/server';

const origin = new URL(process.env.SOFTMAX_APP_ORIGIN ?? 'http://localhost:3000').origin;
const clientId = process.env.SOFTMAX_CLIENT_ID;
const clientSecret = process.env.SOFTMAX_CLIENT_SECRET;
if (!clientId || !clientSecret) throw new Error('Set SOFTMAX_CLIENT_ID and SOFTMAX_CLIENT_SECRET.');

const identity = new BrowserIdentity({
  issuer: process.env.SOFTMAX_ISSUER ?? 'https://identity.softmax.com',
  clientId,
  clientSecret,
  redirectUri: new URL('/api/auth/callback', origin).href,
  scopes: ['openid', 'offline_access'],
});

const browser = await readFile(new URL('./website-browser.js', import.meta.url));
const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <meta name="softmax-client-id" content="${clientId}" />
    <title>Sign in with Softmax</title>
    <script type="module" src="/website-browser.js"></script>
  </head>
  <body>
    <h1>Sign in with Softmax</h1>
    <p role="status">Checking your session…</p>
    <button id="sign-in" hidden>Sign in with Softmax</button>
    <button id="sign-out" hidden>Sign out</button>
  </body>
</html>`;

async function handle(request) {
  const auth = await identity.handle(request);
  if (auth) return auth;
  const { pathname } = new URL(request.url);
  if (request.method === 'GET' && pathname === '/api/viewer') {
    const session = await identity.authenticate(request);
    if (session.kind === 'rejected') return session.response;
    if (session.kind === 'anonymous')
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    return Response.json({ subject: session.subject });
  }
  if (request.method === 'GET' && pathname === '/website-browser.js')
    return new Response(browser, { headers: { 'content-type': 'text/javascript; charset=utf-8' } });
  if (request.method === 'GET' && pathname === '/')
    return new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  return new Response(null, { status: 404 });
}

const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, origin);
    const method = incoming.method ?? 'GET';
    if (url.origin !== origin || !['GET', 'POST'].includes(method)) {
      outgoing.writeHead(400).end();
      return;
    }
    const chunks = [];
    let bytes = 0;
    for await (const chunk of incoming) {
      bytes += chunk.byteLength;
      if (bytes > 8192) {
        outgoing.writeHead(413).end();
        return;
      }
      chunks.push(chunk);
    }
    const request = new Request(url, {
      method,
      headers: incoming.headers,
      body: method === 'POST' ? Buffer.concat(chunks) : undefined,
    });
    const response = await handle(request);
    const headers = Object.fromEntries(response.headers);
    const cookies = response.headers.getSetCookie();
    if (cookies.length) headers['set-cookie'] = cookies;
    headers['cache-control'] = 'no-store';
    headers['referrer-policy'] = 'no-referrer';
    headers['x-content-type-options'] = 'nosniff';
    headers['content-security-policy'] =
      "default-src 'self'; frame-ancestors 'none'; base-uri 'none'";
    const body = Buffer.from(await response.arrayBuffer());
    outgoing.writeHead(response.status, headers).end(body);
  } catch {
    outgoing.writeHead(503, { 'cache-control': 'no-store' }).end('Sign-in is unavailable.');
  }
});

const port = Number(process.env.PORT ?? (new URL(origin).port || 3000));
server.listen(port, '127.0.0.1', () => console.log(`Open ${origin}`));
