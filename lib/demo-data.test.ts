// 실제 데모 데이터(data/refit_demo_data.zip) 기준 값 고정. 실행: npm run test:api (unzip 필요)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { findGroups, type GroupRow } from './groups.ts';
import { candidateReasons, chipFlows, neighborCounts, pickStored, referencePriceIds, routeShare, NOTICE_ITEMS, type Flow, type Proc } from './fit.ts';

const root = new URL('../', import.meta.url);
const zip = new URL('data/refit_demo_data.zip', root).pathname;

// RFC 4180 CSV(따옴표 안 쉼표, 줄바꿈, "" 이스케이프)
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  const cols = head.map(h => h.replace(/^﻿/, ''));
  return body.filter(r => r.length === cols.length).map(r => Object.fromEntries(cols.map((k, i) => [k, r[i]])));
}

export const demoCsv = (name: string) =>
  parseCsv(execFileSync('unzip', ['-p', zip, `demo/${name}.csv`], { maxBuffer: 64 << 20 }).toString('utf8'));
const dataJson = (name: string) => JSON.parse(readFileSync(new URL(`data/${name}`, root), 'utf8'));

const flows: Flow[] = demoCsv('flows').map(r => ({
  factory_id: r.factory_id || null, processor_id: r.processor_id || null, method: r.method || null,
  method_by_other_group_permit: r.method_by_other_group_permit === 'True', region: r.region || null,
  waste_type: r.waste_type || null, waste_group: r.waste_group || null, weight: Number(r.weight),
  transporter: r.transporter || null,
}));
const chips: Record<string, { id: string; waste_group: string }> = Object.fromEntries(demoCsv('waste_chips').map(c => [c.id, { id: c.id, waste_group: c.waste_group }]));
const chipTypes: Record<string, string[]> = dataJson('chip_waste_types.json');
const home: Record<string, { reports: number; burn_factories: number; recycle_factories: number }> = dataJson('home_waste_stats.json');
const prices = demoCsv('unit_prices').map(r => ({ id: r.id, category: r.category, item: r.item, waste_group: r.waste_group || null, year: Number(r.year) }));
const forChip = (id: string) => chipFlows(flows.filter(f => f.waste_group === chips[id].waste_group), chipTypes[id]);

test('폐합성수지 칩: 원 표기 기준 총 신고 1,209, 소각 445, 재활용 125(본인 공장 포함)', () => {
  const fs = forChip('C01');
  assert.equal(routeShare(fs).total_reports, 1209);
  assert.deepEqual(neighborCounts(fs), { recycling: 125, burning: 445 });
});

test('홈 칩 4개 통계와 결과 화면 집계가 같은 숫자', () => {
  for (const [name, id] of [['폐합성수지', 'C01'], ['폐수처리오니', 'C02'], ['폐활성탄', 'C03'], ['폐유', 'C04']]) {
    const fs = forChip(id);
    assert.equal(routeShare(fs).total_reports, home[name].reports, name);
    assert.deepEqual(neighborCounts(fs), { recycling: home[name].recycle_factories, burning: home[name].burn_factories }, name);
  }
});

test('칩 waste_types는 모두 그 칩의 폐기물군 안에 있음', () => {
  for (const [id, types] of Object.entries(chipTypes)) {
    const inGroup = new Set(flows.filter(f => f.waste_group === chips[id].waste_group).map(f => f.waste_type));
    assert.ok(types.length > 0 && types.every(t => inGroup.has(t)), id);
  }
  assert.equal(Object.keys(chipTypes).length, Object.keys(chips).length);
});

test('공개 단가: 폐합성수지 U001, U035, U161, U176 + 2027 고시 U060, U096', () => {
  assert.deepEqual(referencePriceIds(chips.C01, prices), ['U001', 'U035', 'U060', 'U096', 'U161', 'U176']);
});

test('공개 단가: 폐유 칩에 U001(폐유, 폐유기용제(비할로겐족), 폐합성수지, 폐합성고무)과 2027 U060', () => {
  assert.deepEqual(referencePriceIds(chips.C04, prices),
    ['U001', 'U018', 'U026', 'U039', 'U060', 'U077', 'U087', 'U100', 'U148', 'U149', 'U150', 'U151', 'U176']);
});

test('공개 단가: 매핑의 item 원문이 모두 실제 고시 행에 있고, 고르는 고시 행은 2022, 2027이 짝', () => {
  const notice = prices.filter(p => p.category === '고시 처리단가');
  const items = new Set(notice.map(p => p.item));
  for (const [id, list] of Object.entries(NOTICE_ITEMS)) for (const it of list) assert.ok(items.has(it), `${id} ${it}`);
  for (const c of Object.values(chips)) {
    const ids = referencePriceIds(c, prices);
    assert.ok(ids.every(id => id !== 'U177'), c.id);
    const years = notice.filter(p => ids.includes(p.id)).map(p => p.year);
    assert.equal(years.filter(y => y === 2022).length, years.filter(y => y === 2027).length, c.id);
  }
  assert.deepEqual(referencePriceIds(chips.C05, prices),
    ['U001', 'U002', 'U016', 'U017', 'U060', 'U061', 'U075', 'U076', 'U152', 'U153', 'U154', 'U155', 'U176']);
});

test('저장 후보에서 에너지회수 업체 0곳(P0235 포함 3행 제외)', () => {
  const procs = new Map<string, Proc>(demoCsv('processors').map(r => [r.id,
    { id: r.id, method: r.method || null, confirmed: r.confirmed === 'True', lat: null, lng: null, coord_verified: null }]));
  const sets = new Map<string, ReturnType<typeof demoCsv>>();
  for (const r of demoCsv('fit_candidates')) {
    const k = `${r.factory_id}|${r.waste_group}`;
    sets.set(k, [...(sets.get(k) ?? []), r]);
  }
  let picked = 0;
  for (const rows of sets.values()) {
    const out = pickStored(rows.map(r => ({ processor_id: r.candidate_processor_id, fit_score: Number(r.fit_score),
      evidence_rows: Number(r.evidence_rows), distance_km: null, distance_quality: null, candidate_confirmed: r.candidate_confirmed === 'True' })), procs);
    picked += out.length;
    for (const c of out) assert.ok(!['에너지회수', '소각', '매립'].includes(procs.get(c.processor_id)?.method ?? ''), c.processor_id);
  }
  assert.ok(picked > 0);
});

test('묶음: F0036은 G0158(성곡동 10곳), 좌표 없는 F0001은 성곡동 동 기준 묶음', () => {
  const groups: GroupRow[] = demoCsv('group_fit').map(r => ({ group_id: r.group_id, waste_group: r.waste_group,
    factory_ids: JSON.parse(r.factory_ids), n: Number(r.n), centroid_lat: Number(r.centroid_lat), centroid_lng: Number(r.centroid_lng),
    max_dist_km: Number(r.max_dist_km), dongs: JSON.parse(r.dongs), n_distinct_processors: Number(r.n_distinct_processors) }));
  const fac = Object.fromEntries(demoCsv('factories').map(r => [r.id, { id: r.id, dong: r.dong || null,
    coord_verified: r.coord_verified === 'True' ? true : null, waste_groups: JSON.parse(r.waste_groups || '[]') }]));
  assert.deepEqual(findGroups(fac.F0036, groups, '폐합성수지류').map(x => [x.group.group_id, x.match, x.group.n]), [['G0158', 'member', 10]]);
  const f1 = findGroups(fac.F0001, groups, '폐합성수지류');
  assert.equal(f1.length, 1);
  assert.equal(f1[0].match, 'dong');
  assert.ok(f1[0].group.dongs.includes('성곡동'));
});

test('추천 이유 F0001 폐합성수지: 이웃 28/14/10, 같은 동(성곡동) 6/4/4, (주)동우 운반 연결 없음, 안산 업체 2곳', () => {
  const group = flows.filter(f => f.waste_group === '폐합성수지류');
  const procRows = Object.fromEntries(demoCsv('processors').map(r => [r.id, r]));
  const factoryDong = new Map(demoCsv('factories').map(r => [r.id, r.dong || null]));
  const top = demoCsv('fit_candidates').filter(r => r.factory_id === 'F0001' && r.waste_group === '폐합성수지류')
    .map(r => ({ processor_id: r.candidate_processor_id, neighbors: Number(r.evidence_rows), sigungu: procRows[r.candidate_processor_id].sigungu || null }));
  assert.deepEqual(top.map(c => c.processor_id), ['P0025', 'P0065', 'P0040']);
  const ids = new Set([...top.map(c => c.processor_id), 'P0101']);
  const transportRows = flows.filter(f => ids.has(f.processor_id ?? '')).map(f => ({ processor_id: f.processor_id!, transporter: f.transporter ?? null }));
  const ctx = { flows: group, self: { factory_id: 'F0001', dong: factoryDong.get('F0001') ?? null }, factoryDong, transportRows };
  const r = candidateReasons(top, ctx);
  const pick = (i: number, t: string) => r[i].find(x => x.type === t);
  assert.deepEqual(top.map((_, i) => pick(i, 'neighbors_same_group')?.count), [28, 14, 10]);
  assert.deepEqual(top.map((_, i) => pick(i, 'same_dong')?.count), [6, 4, 4]);
  assert.equal(pick(0, 'same_dong')?.text, '같은 동(성곡동) 공장 6곳이 이 업체에 보내요');
  assert.deepEqual(top.map((_, i) => !!pick(i, 'transporter_link')), [false, false, false]);   // (주)동우는 세 업체로 운반 신고 없음
  assert.deepEqual(top.map((_, i) => !!pick(i, 'in_ansan')), [false, true, true]);             // 평택시, 안산시, 안산시
  // (주)동우가 운반하는 재활용 업체(P0101)라면 연결 이유가 붙는다(실제 신고 기준)
  const p101 = candidateReasons([{ processor_id: 'P0101', neighbors: 1, sigungu: procRows.P0101.sigungu || null }], ctx)[0];
  assert.equal(p101.find(x => x.type === 'transporter_link')?.text, '지금 운반업체 (주)동우가 이 업체로도 운반해요');
});
