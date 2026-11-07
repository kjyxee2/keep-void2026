// 실행: npm run test:api (Node 22 타입 제거로 바로 실행)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addBusinessDays, candidateReasons, chipFlows, splitTransporters, neighborCounts, referencePriceIds, priceYearLabel, pickAnsan, pickStored, rankComputed, splitAnsan, resolveCurrentMethod, routeShare, type Flow, type Proc } from './fit.ts';

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

// 추천 이유: 순위, fit_score는 바꾸지 않고 화면 설명만 붙인다(research/ai/recommender v2 권고)
const rf = (factory_id: string, processor_id: string, method: string, transporter: string | null = null, other = false): Flow =>
  ({ ...f(factory_id, processor_id, method, 1, other), transporter });
const reasonFlows = [
  rf('F1', 'P1', '소각', '(주)동우'),                                  // 본인 공장, 지금 운반업체 (주)동우
  rf('F2', 'R1', '물질재활용'), rf('F3', 'R1', '물질재활용'), rf('F4', 'R1', '물질재활용'),
  rf('F5', 'R1', '물질재활용', null, true),                           // 다른 폐기물군 허가는 같은 동 수에 넣지 않음
  rf('F3', 'R2', '중간가공(R10)'),                                     // 재활용이 아니면 같은 동 수에 넣지 않음
];
const dongs = new Map([['F1', '성곡동'], ['F2', '성곡동'], ['F3', '성곡동'], ['F4', '원시동'], ['F5', '성곡동']]);
const transportRows = [
  { processor_id: 'R1', transporter: '(주)지엔티_ (주)동우' },          // 운반자 여러 곳은 '_'로 이어 적힘
  { processor_id: 'R2', transporter: '자가' },
];
const cands = [
  { processor_id: 'R1', neighbors: 3, sigungu: '안산시' },
  { processor_id: 'R2', neighbors: 1, sigungu: '평택시' },
];

test('splitTransporters splits on underscore, trims, drops 자가 and blanks', () => {
  assert.deepEqual(splitTransporters('(주)지엔티_ (주)동우'), ['(주)지엔티', '(주)동우']);
  assert.deepEqual(splitTransporters('자가_대일개발(주)'), ['대일개발(주)']);
  assert.deepEqual(splitTransporters(null), []);
});

test('reasons with factory: neighbors, same dong, transporter link, in Ansan', () => {
  const r = candidateReasons(cands, {
    flows: reasonFlows, self: { factory_id: 'F1', dong: '성곡동' }, factoryDong: dongs, transportRows,
  });
  const basis = '신고 건수 집계 2026-07';
  assert.deepEqual(r[0], [
    { type: 'neighbors_same_group', count: 3, text: '같은 폐기물군을 이 업체에 재활용으로 보내는 안산 공장 3곳', basis },
    { type: 'same_dong', count: 2, text: '같은 동(성곡동) 공장 2곳이 이 업체에 보내요', basis },
    { type: 'transporter_link', text: '지금 운반업체 (주)동우가 이 업체로도 운반해요', basis },
    { type: 'in_ansan', text: '안산 안의 업체예요', basis },
  ]);
  // R2: 같은 동 재활용 0곳, 운반 연결 없음, 안산 밖 → 이웃 수만
  assert.deepEqual(r[1].map(x => x.type), ['neighbors_same_group']);
});

test('transporter josa follows the last syllable (받침 있으면 이)', () => {
  const r = candidateReasons([cands[0]], {
    flows: [rf('F1', 'P1', '소각', '(주)한성')], self: { factory_id: 'F1', dong: null }, factoryDong: dongs,
    transportRows: [{ processor_id: 'R1', transporter: '(주)한성' }],
  });
  assert.equal(r[0].find(x => x.type === 'transporter_link')?.text, '지금 운반업체 (주)한성이 이 업체로도 운반해요');
  assert.equal(r[0].some(x => x.type === 'same_dong'), false);        // 동을 모르면 같은 동 이유 없음
});

test('reasons without factory: only neighbors and in Ansan', () => {
  const r = candidateReasons(cands, { flows: reasonFlows, self: null, factoryDong: dongs, transportRows });
  assert.deepEqual(r[0].map(x => x.type), ['neighbors_same_group', 'in_ansan']);
  assert.deepEqual(r[1].map(x => x.type), ['neighbors_same_group']);
});

test('pickAnsan: 상위에 안산 업체가 있으면 null, 없으면 자격 있는 안산 업체 중 점수 1위를 rank 0으로', () => {
  const procs = new Map<string, Proc>([
    ['A1', { ...p('A1', '물질재활용'), sigungu: '안산시' }],
    ['A2', { ...p('A2', '물질재활용'), sigungu: '안산시 단원구' }],
    ['A3', { ...p('A3', '물질재활용'), sigungu: '안산시' }],
    ['X1', { ...p('X1', '물질재활용'), sigungu: '평택시' }],
  ]);
  const r = (id: string, fit_score: number, evidence_rows = 3) => ({ rank: 1, processor_id: id, fit_score, evidence_rows,
    distance_km: null, distance_quality: null, candidate_confirmed: true, source: 'computed' as const });
  const top = [r('X1', 90)];
  assert.equal(pickAnsan([r('A1', 90)], [r('A2', 80)], procs, new Set())?.processor_id ?? null, null);
  assert.deepEqual(pickAnsan(top, [r('A1', 50), r('A2', 70), r('A3', 99, 0)], procs, new Set()), { ...r('A2', 70), rank: 0 });
  assert.equal(pickAnsan(top, [r('A2', 70), r('A1', 50)], procs, new Set(['A2']))?.processor_id, 'A1');   // 이미 쓰는 업체 제외
  assert.equal(pickAnsan(top, [r('A1', 50), { ...r('A1', 95), source: 'computed' }], procs, new Set())?.fit_score, 50); // 먼저 온 저장 행
  assert.equal(pickAnsan(top, [], procs, new Set()), null);
});

test('splitAnsan: rank 0은 already_in_top false, 없으면 상위의 첫 안산 업체를 already_in_top true', () => {
  const c = (rank: number, sigungu: string | null) => ({ rank, sigungu, processor_id: `P${rank}` });
  assert.deepEqual(splitAnsan([c(1, '평택시'), c(0, '안산시'), c(2, '화성시')]),
    { top: [c(1, '평택시'), c(2, '화성시')], ansan: { ...c(0, '안산시'), already_in_top: false } });
  assert.deepEqual(splitAnsan([c(1, '평택시'), c(2, '안산시'), c(3, '안산시')]).ansan, { ...c(2, '안산시'), already_in_top: true });
  assert.equal(splitAnsan([c(1, '평택시')]).ansan, null);
});
