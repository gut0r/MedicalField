import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';

const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; font-src 'self' data:",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

function proxyRequest(request, response, serverOrigin) {
  const incoming = new URL(request.url, 'http://127.0.0.1');
  const target = new URL(`${incoming.pathname}${incoming.search}`, serverOrigin);
  const transport = target.protocol === 'https:' ? https : http;
  const headers = { ...request.headers, host: target.host };
  delete headers.origin;
  delete headers.referer;

  const upstream = transport.request({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || undefined,
    method: request.method,
    path: `${target.pathname}${target.search}`,
    headers,
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });

  upstream.setTimeout(20_000, () => upstream.destroy(new Error('Tempo limite ao acessar a VM')));
  upstream.on('error', (error) => {
    if (response.headersSent) return response.destroy(error);
    response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ detail: 'Servidor central indisponível' }));
  });
  request.pipe(upstream);
}

async function sendFile(request, response, filename) {
  const stat = await fs.promises.stat(filename);
  const headers = {
    ...SECURITY_HEADERS,
    'Content-Type': MIME_TYPES.get(path.extname(filename).toLowerCase()) ?? 'application/octet-stream',
    'Content-Length': String(stat.size),
    'Cache-Control': filename.endsWith('index.html') || filename.endsWith('sw.js') ? 'no-store' : 'public, max-age=31536000, immutable',
  };
  response.writeHead(200, headers);
  if (request.method === 'HEAD') return response.end();
  fs.createReadStream(filename).pipe(response);
}

async function staticRequest(request, response, rendererDir) {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/' || url.pathname === '/field') {
    response.writeHead(302, { Location: '/field/' });
    return response.end();
  }
  if (!url.pathname.startsWith('/field/')) {
    response.writeHead(404, SECURITY_HEADERS);
    return response.end('Não encontrado');
  }

  let relative;
  try {
    relative = decodeURIComponent(url.pathname.slice('/field/'.length));
  } catch {
    response.writeHead(400, SECURITY_HEADERS);
    return response.end('Caminho inválido');
  }

  const root = path.resolve(rendererDir);
  const candidate = path.resolve(root, relative || 'index.html');
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403, SECURITY_HEADERS);
    return response.end('Acesso negado');
  }

  try {
    const stat = await fs.promises.stat(candidate);
    if (stat.isFile()) return sendFile(request, response, candidate);
  } catch {
    // Rotas da SPA são resolvidas pelo index; arquivos ausentes continuam 404.
  }

  if (path.extname(relative)) {
    response.writeHead(404, SECURITY_HEADERS);
    return response.end('Arquivo não encontrado');
  }
  return sendFile(request, response, path.join(root, 'index.html'));
}

export function startLocalServer({ rendererDir, serverOrigin, port = 47831, host = '127.0.0.1' }) {
  const remote = new URL(serverOrigin);
  if (!['http:', 'https:'].includes(remote.protocol)) throw new Error('serverOrigin deve usar HTTP ou HTTPS');

  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, `http://${host}`).pathname;
    const action = pathname.startsWith('/api/')
      ? Promise.resolve(proxyRequest(request, response, remote))
      : staticRequest(request, response, rendererDir);
    action.catch((error) => {
      if (response.headersSent) return response.destroy(error);
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Falha ao abrir o cliente local');
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      resolve({ server, origin: `http://${host}:${actualPort}` });
    });
  });
}
