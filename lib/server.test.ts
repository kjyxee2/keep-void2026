import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cached, json } from './server.ts';

test('cached() adds CDN cache header for public reference GETs', async () => {
  const r = cached({ ok: 1 });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'public, s-maxage=3600, stale-while-revalidate=86400');
  assert.deepEqual(await r.json(), { ok: 1 });
  assert.equal(json({}).headers.get('cache-control'), null);   // 진단, 요청 응답은 캐시하지 않음
});
