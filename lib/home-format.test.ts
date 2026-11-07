import { test } from 'node:test';
import assert from 'node:assert/strict';
import { axisMax, formatThousands, parseWon } from './home-format.ts';
import { toPriceRows, HOME_PRICE_IDS } from './home-prices.ts';
import { toChipViews } from './home-stats.ts';

test('천 단위 쉼표: 숫자만 남기고 앞의 0은 지움', () => {
  assert.equal(formatThousands('280000'), '280,000');
  assert.equal(formatThousands('28만0000원'), '280,000');
  assert.equal(formatThousands('0012'), '12');
  assert.equal(formatThousands(''), '');
  assert.equal(formatThousands('abc'), '');
  assert.equal(formatThousands('12345678901234'), '1,234,567,890');
});

test('입력 해석: 0과 빈 값은 null', () => {
  assert.equal(parseWon('280,000'), 280000);
  assert.equal(parseWon(''), null);
  assert.equal(parseWon('0'), null);
});

test('막대 축: 공개 단가와 입력값 중 가장 큰 값', () => {
  assert.equal(axisMax([297000, 316000, 144000], null), 316000);
  assert.equal(axisMax([297000, 316000], 280000), 316000);
  assert.equal(axisMax([297000], 500000), 500000);
  assert.equal(axisMax([], null), 1);
});

test('공개 단가 행: 2022 적용분과 2027 시행분을 한 줄로, 원값 그대로', () => {
  const all = [
    { id: 'U001', price_won: 297000, year: 2022 }, { id: 'U060', price_won: 316000, year: 2027 },
    { id: 'U035', price_won: 269000, year: 2022 }, { id: 'U096', price_won: 287000, year: 2027 },
    { id: 'U161', price_won: 260000, year: 2021 }, { id: 'U176', price_won: 144000, year: 2023 },
    { id: 'U999', price_won: 1, year: 2022 },
  ];
  const rows = toPriceRows(all);
  assert.deepEqual(rows.map((r) => [r.id, r.price_won, r.next?.price_won ?? null]),
    [['U001', 297000, 316000], ['U035', 269000, 287000], ['U161', 260000, null], ['U176', 144000, null]]);
  // 2022 행이 없으면 2027 값을 큰 숫자로
  const only2027 = toPriceRows(all.filter((r) => r.id !== 'U035'));
  assert.deepEqual(only2027.map((r) => [r.id, r.detail, r.next]), [['U001', '2022 적용', { id: 'U060', price_won: 316000, year: 2027 }],
    ['U096', '2027 시행', null], ['U161', '2021, 부가세 별도', null], ['U176', '코엔텍 2023년 1분기, 울산 1개사', null]]);
  assert.deepEqual([...HOME_PRICE_IDS], ['U001', 'U060', 'U035', 'U096', 'U161', 'U176']);
});

test('칩 지표: Figma 칩 프레임 구성, 값 없는 지표는 뺌', () => {
  const base = { reports: 1, burn_factories: 445, recycle_factories: 125, both_factories: 75, in_ansan_pct: 31.3,
    outside_gyeonggi_pct: 16, region_unknown_pct: 8.1, recycle_pct: 13.5, burn_pct: 49.3 };
  const views = toChipViews([
    { ...base, chip_id: 'C02', name: '폐수처리오니', outside_gyeonggi_pct: 64.2, in_ansan_pct: null },
    { ...base, chip_id: 'C01', name: '폐합성수지' },
  ]);
  assert.deepEqual(views.map((v) => v.name), ['폐합성수지', '폐수처리오니']);
  assert.deepEqual(views[0].stats.map((s) => `${s.value}${s.unit}`), ['445곳', '125곳', '75곳']);
  assert.deepEqual(views[1].stats.map((s) => `${s.value}${s.unit}`), ['64.2%', '125곳']);
});
