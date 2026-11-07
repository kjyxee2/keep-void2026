// 실제 데모 데이터(data/refit_demo_data.zip) 기준 값 고정. 실행: npm run test:api (unzip 필요)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chipFlows, neighborCounts, routeShare, type Flow } from './fit.ts';

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
}));
const chips = Object.fromEntries(demoCsv('waste_chips').map(c => [c.id, c]));
const chipTypes: Record<string, string[]> = dataJson('chip_waste_types.json');
const home: Record<string, { reports: number; burn_factories: number; recycle_factories: number }> = dataJson('home_waste_stats.json');
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
