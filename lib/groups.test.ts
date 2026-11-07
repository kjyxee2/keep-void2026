import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findGroups, groupView, type GroupRow } from './groups.ts';

const g = (group_id: string, waste_group: string, factory_ids: string[], dongs: string[]): GroupRow => ({
  group_id, waste_group, factory_ids, n: factory_ids.length, centroid_lat: 37.31, centroid_lng: 126.75,
  max_dist_km: 0.2, dongs, n_distinct_processors: 3,
});
const groups = [
  g('G1', '폐합성수지류', ['F1', 'F2'], ['성곡동']),
  g('G2', '폐합성수지류', ['F3', 'F4', 'F5'], ['성곡동', '원시동']),
  g('G3', '폐합성수지류', ['F6', 'F7', 'F8'], ['성곡동']),
  g('G4', '오니류', ['F1', 'F9'], ['성곡동']),
];

test('member factory gets its own groups, filtered by waste group', () => {
  const me = { id: 'F1', dong: '성곡동', coord_verified: true, waste_groups: ['폐합성수지류', '오니류'] };
  assert.deepEqual(findGroups(me, groups, '폐합성수지류').map(x => [x.group.group_id, x.match]), [['G1', 'member']]);
  assert.deepEqual(findGroups(me, groups, null).map(x => x.group.group_id), ['G1', 'G4']);
});

test('factory without verified coords falls back to the largest same-dong group (ties: lower id)', () => {
  const me = { id: 'F0', dong: '성곡동', coord_verified: null, waste_groups: ['폐합성수지류'] };
  assert.deepEqual(findGroups(me, groups, '폐합성수지류').map(x => [x.group.group_id, x.match]), [['G2', 'dong']]);
  assert.deepEqual(findGroups({ ...me, coord_verified: true }, groups, '폐합성수지류'), []);   // 좌표 확인 공장은 동 대체 없음
  assert.deepEqual(findGroups({ ...me, dong: null }, groups, '폐합성수지류'), []);
});

test('group view has points without names or ids, marks self, [lng, lat] order', () => {
  const coords = new Map([['F1', { lat: 37.3, lng: 126.7 }], ['F2', { lat: 37.4, lng: 126.8 }]]);
  const v = groupView({ group: groups[0], match: 'member' }, coords, 'F1');
  assert.deepEqual(v.center, [126.75, 37.31]);
  assert.equal(v.radius_km, 0.2);
  assert.equal(v.n_factories, 2);
  assert.equal(v.n_processors, 3);
  assert.deepEqual(v.points, [{ coordinates: [126.7, 37.3], self: true }, { coordinates: [126.8, 37.4], self: false }]);
  assert.ok(!JSON.stringify(v).includes('F1') && !JSON.stringify(v).includes('F2'));
});
