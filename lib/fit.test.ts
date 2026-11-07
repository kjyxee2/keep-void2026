// 실행: npm run test:api (Node 22 타입 제거로 바로 실행)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addBusinessDays, chipFlows, neighborCounts, referencePriceIds, priceYearLabel, pickStored, rankComputed, resolveCurrentMethod, routeShare, type Flow, type Proc } from './fit.ts';

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

test('reference prices: 칩별 고시 item 원문 매핑(2022, 2027 둘 다) + 공제조합 행, 소각 비교가 있을 때만 U176', () => {
  const u = (id: string, category: string, waste_group: string | null, item: string, year = 2022) => ({ id, category, waste_group, item, year });
  const U001 = '폐유, 폐유기용제(비할로겐족), 폐합성수지, 폐합성고무';
  const prices = [u('U001', '고시 처리단가', null, U001), u('U060', '고시 처리단가', null, U001, 2027),
    u('U035', '고시 처리단가', '폐합성수지류', '폐합성수지'), u('U096', '고시 처리단가', '폐합성수지류', '폐합성수지', 2027),
    u('U028', '고시 처리단가', null, '폐플라스틱 용기'),
    u('U160', '공제조합 소각처리단가(일반)', '폐합성수지류', '폐합성수지, 폐합성고무', 2020),
    u('U161', '공제조합 소각처리단가(일반)', '폐합성수지류', '폐합성수지, 폐합성고무', 2021),
    u('U129', '지정 공공처리시설 반입수수료', '폐합성수지류', '폐합성수지'),
    u('U018', '고시 처리단가', '폐유', '폐윤활유'), u('U148', '공제조합 소각처리단가(지정)', '폐유', '폐유 액상', 2020),
    u('U121', '지정 공공처리시설 반입수수료', '폐유', '폐유'),
    u('U052', '고시 처리단가', '폐목재', '폐목재'), u('U176', '민간 평균 처리단가', null, '소각 평균 처리단가', 2023),
    u('U177', '민간 평균 처리단가', null, '매립 평균 처리단가', 2023)];
  // C01: 결정 3의 4개 + 2027 고시(U060, U096). 공제조합은 결정 3대로 U161만
  assert.deepEqual(referencePriceIds({ id: 'C01', waste_group: '폐합성수지류' }, prices), ['U001', 'U035', 'U060', 'U096', 'U161', 'U176']);
  // C04 폐유: U001 item 원문에 폐유가 있으므로 포함
  assert.deepEqual(referencePriceIds({ id: 'C04', waste_group: '폐유' }, prices), ['U001', 'U018', 'U060', 'U148', 'U176']);
  assert.deepEqual(referencePriceIds({ id: 'C08', waste_group: '폐목재' }, prices), ['U052']);   // 공제조합 소각 행 없음 → U176 없음
  assert.deepEqual(referencePriceIds({ id: 'C99', waste_group: '폐목재' }, prices), []);   // 매핑 없는 칩은 고시 없음
});

test('reference price label: 고시 2022 적용, 2027 시행, 나머지는 연도', () => {
  assert.equal(priceYearLabel({ category: '고시 처리단가', year: 2022 }), '2022 적용');
  assert.equal(priceYearLabel({ category: '고시 처리단가', year: 2027 }), '2027 시행');
  assert.equal(priceYearLabel({ category: '공제조합 소각처리단가(일반)', year: 2021 }), '2021년');
  assert.equal(priceYearLabel({ category: '민간 평균 처리단가', year: null }), null);
});

test('candidates drop processors whose method is 에너지회수, 소각, 매립', () => {
  const ps = new Map([p('E1', '에너지회수'), p('B1', '소각'), p('L1', '매립'), p('R1', '물질재활용'), p('M1', '중간가공(R10)')].map(x => [x.id, x]));
  const row = (processor_id: string) =>
    ({ processor_id, fit_score: 90, evidence_rows: 1, distance_km: null, distance_quality: null, candidate_confirmed: true });
  assert.deepEqual(pickStored(['E1', 'B1', 'L1', 'R1', 'M1'].map(row), ps).map(x => x.processor_id), ['R1', 'M1']);
  const fs = ['E1', 'B1', 'L1', 'R1'].map((id, i) => f(`F${i + 10}`, id, '물질재활용'));
  assert.deepEqual(rankComputed({ flows: fs, procs: ps, currentMethod: '소각', origin: null, selfFactoryId: null }).map(x => x.processor_id), ['R1']);
});
