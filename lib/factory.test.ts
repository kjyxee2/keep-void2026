import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FACTORY_PUBLIC_COLUMNS, isFactoryIdParam, publicFactory } from './factory.ts';

test('GET /api/factories/:id 공개 열만: id, name, dong, waste_groups, coord_verified, n_waste_types', () => {
  assert.equal(FACTORY_PUBLIC_COLUMNS, 'id,name,dong,waste_groups,coord_verified,n_waste_types');
  const row = { id: 'F0001', name: '(주)시험', dong: '성곡동', waste_groups: ['폐합성수지류'], coord_verified: null, n_waste_types: 3,
    address: '경기 안산시 단원구', lat: 37.3, lng: 126.8, sheet: '사업장일반' };
  assert.deepEqual(publicFactory(row), { id: 'F0001', name: '(주)시험', dong: '성곡동', waste_groups: ['폐합성수지류'], coord_verified: false, n_waste_types: 3 });
  assert.deepEqual(publicFactory({ id: 'F0002', name: 'x' }), { id: 'F0002', name: 'x', dong: null, waste_groups: [], coord_verified: false, n_waste_types: null });
});

test('factory id 모양 검사(F + 숫자 1~6자리)', () => {
  for (const ok of ['F0001', 'F1', 'F123456']) assert.equal(isFactoryIdParam(ok), true, ok);
  for (const bad of ['', 'F', 'P0001', 'F0001;', 'f0001', 'F1234567']) assert.equal(isFactoryIdParam(bad), false, bad);
});
