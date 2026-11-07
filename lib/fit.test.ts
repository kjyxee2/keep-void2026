// 실행: npm run test:api (Node 22 타입 제거로 바로 실행)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addBusinessDays, chipFlows, neighborCounts, pickStored, rankComputed, resolveCurrentMethod, routeShare, type Flow, type Proc } from './fit.ts';

const f = (factory_id: string, processor_id: string | null, method: string, weight = 1, other = false): Flow =>
  ({ factory_id, processor_id, method, method_by_other_group_permit: other, region: '안산', weight });
const p = (id: string, method: string, extra: Partial<Proc> = {}): Proc =>
  ({ id, method, confirmed: true, lat: null, lng: null, coord_verified: null, ...extra });

const flows = [
  f('F1', 'P1', '소각'),                       // 사용자 공장
  f('F2', 'R1', '물질재활용'), f('F3', 'R1', '물질재활용'), f('F4', 'R1', '물질재활용'),
  f('F2', 'R2', '물질재활용'),
  f('F5', 'R3', '물질재활용', 1, true),         // 다른 폐기물군 허가 → 후보 아님
  f('F6', 'R4', '물질재활용'),                  // 업체 method 복수 허가 → 제외
  f('F7', 'P1', '에너지회수', 0.5), f('F7', 'P2', '소각', 0.5),
];
const procs = new Map([p('R1', '물질재활용'), p('R2', '물질재활용', { confirmed: false, lat: 37.3, lng: 126.8, coord_verified: true }),
  p('R3', '물질재활용'), p('R4', '복수 허가'), p('P1', '소각')].map(x => [x.id, x]));

test('route share sums weights as report counts', () => {
  const r = routeShare(flows);
  assert.equal(r.total_reports, 8);
  assert.equal(r.by_method[0].method, '물질재활용');
  assert.equal(r.by_method[0].reports, 6);
});

test('neighbors count every Ansan factory including own (home stats basis)', () => {
  // F2~F6 재활용 5곳, F1(사용자 공장)과 F7 소각 2곳
  assert.deepEqual(neighborCounts(flows), { recycling: 5, burning: 2 });
});

test('chipFlows keeps only the chip waste types, null keeps the whole group', () => {
  const typed = [{ ...f('F1', 'P1', '소각'), waste_type: 'A' }, { ...f('F2', 'R1', '물질재활용'), waste_type: 'B' }];
  assert.deepEqual(chipFlows(typed, ['A']).map(x => x.factory_id), ['F1']);
  assert.equal(chipFlows(typed, null).length, 2);
});

test('모름 resolves to dominant reported method', () => {
  assert.deepEqual(resolveCurrentMethod('모름', flows), { method: '물질재활용', inferred: true });
  assert.deepEqual(resolveCurrentMethod('매립', flows), { method: '매립', inferred: false });
});

test('computed ranking follows README rule and exclusions', () => {
  const r = rankComputed({ flows, procs, currentMethod: '소각', origin: { lat: 37.3, lng: 126.8 }, selfFactoryId: 'F1' });
  assert.deepEqual(r.map(x => x.processor_id), ['R2', 'R1']);       // R3 다른 군 허가, R4 복수 허가 제외
  // R2: E=ln2/ln4=0.5, D=1(0km), M=0.48+0.4*0.5 → 100*(0.25+0.3+0.136)=68.6
  assert.equal(r[0].fit_score, 68.6);
  assert.equal(r[0].distance_km, 0);                                 // 확인 좌표끼리만 거리
  assert.equal(r[0].distance_quality, 'A 확인 좌표 간 직선');
  // R1: E=1, D=0(좌표 없음), M=0.6*0.8+0.4 → 100*(0.5+0+0.2*0.88)=67.6
  assert.equal(r[1].fit_score, 67.6);
  assert.equal(r[1].distance_km, null);
});

test('stored candidates dedupe processors and drop excluded methods', () => {
  const row = (processor_id: string, fit_score: number) =>
    ({ processor_id, fit_score, evidence_rows: 1, distance_km: null, distance_quality: null, candidate_confirmed: true });
  const r = pickStored([row('R1', 80), row('R4', 99), row('R1', 70), row('R2', 60)], procs);
  assert.deepEqual(r.map(x => [x.rank, x.processor_id, x.fit_score]), [[1, 'R1', 80], [2, 'R2', 60]]);
});

test('business days skip weekend in KST', () => {
  // 2026-11-06(금) 15:00 KST → 11-10(화) 15:00 KST
  const due = addBusinessDays(new Date('2026-11-06T06:00:00Z'), 2);
  assert.equal(due.toISOString(), '2026-11-10T06:00:00.000Z');
});
