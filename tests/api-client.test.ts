// 실행: npm run test:web (Node 22 타입 제거로 바로 실행)
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, cacheMode, createDiagnosis, getChips, getDiagnosis, getFactory, patchDiagnosis, searchFactories, tokenStore } from '../lib/api-client.ts';

class MemStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, String(v));
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];
const g = globalThis as Record<string, unknown>;

function mockFetch(status: number, body: unknown) {
  g.fetch = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(body === undefined ? 'not json' : JSON.stringify(body), { status });
  };
}

beforeEach(() => {
  calls = [];
  tokenStore._clearMemory();
  g.window = {}; // 브라우저처럼 상대 주소 사용
  g.localStorage = new MemStorage();
});

test('토큰을 진단 id별로 localStorage에 저장하고 다시 읽는다', () => {
  tokenStore.set('d1', 't1');
  tokenStore.set('d2', 't2');
  assert.equal((g.localStorage as MemStorage).getItem('refit:anon_token:d1'), 't1');
  tokenStore._clearMemory();
  assert.equal(tokenStore.get('d1'), 't1');
  assert.equal(tokenStore.get('d2'), 't2');
  assert.equal(tokenStore.get('없음'), null);
});

test('localStorage 접근이 막히면 메모리에 저장한다', () => {
  g.localStorage = {
    getItem() {
      throw new Error('SecurityError');
    },
    setItem() {
      throw new Error('SecurityError');
    },
    removeItem() {
      throw new Error('SecurityError');
    },
  };
  tokenStore.set('d1', 't1');
  assert.equal(tokenStore.get('d1'), 't1');
  tokenStore.remove('d1');
  assert.equal(tokenStore.get('d1'), null);
});

test('localStorage가 없는 환경(서버)에서도 메모리로 동작한다', () => {
  delete g.localStorage;
  tokenStore.set('d1', 't1');
  assert.equal(tokenStore.get('d1'), 't1');
});

test('createDiagnosis는 anon_token을 저장하고 다음 호출에 x-anon-token을 붙인다', async () => {
  mockFetch(201, { id: 'd9', anon_token: 'secret' });
  const res = await createDiagnosis('C01');
  assert.equal(res.id, 'd9');
  assert.equal(calls[0].url, '/api/diagnoses');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.body, JSON.stringify({ chip_id: 'C01' }));
  assert.equal(tokenStore.get('d9'), 'secret');

  mockFetch(200, { id: 'd9', status: 'draft', chip_id: 'C01' });
  await patchDiagnosis('d9', { weight_kg_per_month: 2000 });
  const h = calls[1].init.headers as Record<string, string>;
  assert.equal(h['x-anon-token'], 'secret');
  assert.equal(calls[1].init.method, 'PATCH');
});

test('토큰이 없으면 헤더 없이 보낸다(공유 보기)', async () => {
  mockFetch(200, { diagnosis_id: 'x' });
  await getDiagnosis('x');
  assert.equal((calls[0].init.headers as Record<string, string>)['x-anon-token'], undefined);
});

test('오류 응답 { error }를 ApiError로 바꾼다', async () => {
  mockFetch(409, { error: '이미 완료된 진단' });
  await assert.rejects(getChips(), (e: unknown) => {
    assert.ok(e instanceof ApiError);
    assert.equal(e.status, 409);
    assert.equal(e.message, '이미 완료된 진단');
    return true;
  });
});

test('JSON이 아닌 오류 응답도 ApiError(상태 코드 포함)', async () => {
  mockFetch(500, undefined);
  await assert.rejects(getChips(), (e: unknown) => e instanceof ApiError && e.status === 500);
});

test('네트워크 실패는 status 0 ApiError', async () => {
  g.fetch = async () => {
    throw new TypeError('fetch failed');
  };
  await assert.rejects(getChips(), (e: unknown) => e instanceof ApiError && e.isNetwork && e.message.includes('연결이 끊겼어요'));
});

test('getFactory는 GET /api/factories/:id(토큰 없이), 없는 공장은 404 ApiError', async () => {
  mockFetch(200, { id: 'F0001', name: 'x', dong: '성곡동', waste_groups: [], coord_verified: false, n_waste_types: 3 });
  const f = await getFactory('F0001');
  assert.equal(calls[0].url, '/api/factories/F0001');
  assert.equal(new Headers(calls[0].init.headers).get('x-anon-token'), null);
  assert.equal(f.dong, '성곡동');
  mockFetch(404, { error: 'not found' });
  await assert.rejects(getFactory('F9999'), (e: unknown) => e instanceof ApiError && e.status === 404);
});

test('PATCH 본문에 current_processor_id, current_processor_name_raw를 그대로 보낸다', async () => {
  tokenStore.set('d1', 't1');
  mockFetch(200, { id: 'd1' });
  await patchDiagnosis('d1', { current_processor_id: 'P0065', current_processor_name_raw: null });
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { current_processor_id: 'P0065', current_processor_name_raw: null });
});

test('공개 GET은 브라우저 기본 캐시, 쓰기와 토큰이 붙는 조회는 no-store', async () => {
  mockFetch(200, {});
  await getChips();
  await searchFactories('성곡');
  tokenStore.set('d1', 't1');
  await getDiagnosis('d1');
  await patchDiagnosis('d1', { current_processor_id: null });
  assert.deepEqual(calls.map((c) => c.init.cache), ['default', 'default', 'no-store', 'no-store']);
  assert.equal(cacheMode({ method: 'POST' }), 'no-store');
  assert.equal(cacheMode({ cache: 'reload' }), 'reload');
});
