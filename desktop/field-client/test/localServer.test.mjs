import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { startLocalServer } from '../src/localServer.mjs';

test('servidor desktop entrega a SPA e encaminha a API para o servidor central', async (context) => {
  const rendererDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'medicalfield-renderer-'));
  await fs.promises.writeFile(path.join(rendererDir, 'index.html'), '<h1>MedicalField local</h1>');

  const upstream = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ path: request.url, client: request.headers['x-medicalfield-client'] }));
  });
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const upstreamAddress = upstream.address();
  const upstreamOrigin = `http://127.0.0.1:${upstreamAddress.port}`;

  const local = await startLocalServer({ rendererDir, serverOrigin: upstreamOrigin, port: 0 });
  context.after(async () => {
    await Promise.all([
      new Promise((resolve) => local.server.close(resolve)),
      new Promise((resolve) => upstream.close(resolve)),
      fs.promises.rm(rendererDir, { recursive: true, force: true }),
    ]);
  });

  const page = await fetch(`${local.origin}/field/encounters/new`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /MedicalField local/);
  assert.equal(page.headers.get('x-frame-options'), 'DENY');

  const api = await fetch(`${local.origin}/api/patients?search=Ana`, {
    headers: { 'X-MedicalField-Client': 'field' },
  });
  assert.equal(api.status, 200);
  assert.deepEqual(await api.json(), { path: '/api/patients?search=Ana', client: 'field' });
});
