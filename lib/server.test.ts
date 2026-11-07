import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cached, fetchAll, json } from './server.ts';

test('cached() adds CDN cache header for public reference GETs', async () => {
  const r = cached({ ok: 1 });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'public, s-maxage=3600, stale-while-revalidate=86400');
  assert.deepEqual(await r.json(), { ok: 1 });
  assert.equal(json({}).headers.get('cache-control'), null);   // 진단, 요청 응답은 캐시하지 않음
});

test('fetchAll() reads the first page with count, then the rest in parallel', async () => {
  const rows = Array.from({ length: 2345 }, (_, i) => i);
  const calls: { from: number; to: number; count?: string; at: number }[] = [];
  let tick = 0;
  const result = await fetchAll<number>((from, to, opts) => {
    calls.push({ from, to, count: opts?.count, at: tick });
    return Promise.resolve({ data: rows.slice(from, to + 1), error: null, count: opts ? rows.length : undefined }).then(r => { tick += 1; return r; });
  });
  assert.deepEqual(result, rows);
  assert.deepEqual(calls.map(c => [c.from, c.to, c.count]), [[0, 999, 'exact'], [1000, 1999, undefined], [2000, 2999, undefined]]);
  assert.equal(calls[1].at, calls[2].at); // 둘째, 셋째 쪽은 첫 쪽이 끝난 뒤 같은 때 요청
});

test('fetchAll() returns one page without extra requests, and throws the page error', async () => {
  let n = 0;
  assert.deepEqual(await fetchAll<number>(() => { n += 1; return Promise.resolve({ data: [1, 2], error: null, count: 2 }); }), [1, 2]);
  assert.equal(n, 1);
  await assert.rejects(fetchAll<number>(() => Promise.resolve({ data: null, error: { message: 'boom' }, count: null })), { message: 'boom' });
});
