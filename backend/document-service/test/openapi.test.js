import test from 'node:test';
import assert from 'node:assert/strict';
import { openApi } from '../src/openapi.js';

test('documentação OpenAPI carrega e descreve os endpoints de documentos', () => {
  assert.equal(openApi.openapi, '3.1.0');
  assert.ok(openApi.paths['/encounters/{id}/pdf'].get);
  assert.ok(openApi.paths['/encounters/{id}/email'].post);
  assert.ok(openApi.paths['/medical-records/{id}/pdf'].get);
});
