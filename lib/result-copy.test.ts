// 실행: node --test lib/result-copy.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskPhone, mergeNoticeYears, normalizePhone, objectParticle } from './result-copy.ts';

const row = (id: string, item: string, method: string, price: number, year_label: string, category = '고시 처리단가') => ({
  id, category, item, method, price_won: price, unit: '원/톤', year: Number(year_label.slice(0, 4)), year_label,
});

test('고시 2022와 2027 같은 item, method는 한 줄, 2022가 큰 값', () => {
  const rows = [
    row('U001', 'A', '처분업자', 297000, '2022 적용'),
    row('U035', '폐합성수지', '재활용업자', 269000, '2022 적용'),
    row('U060', 'A', '처분업자', 316000, '2027 시행'),
    row('U096', '폐합성수지', '재활용업자', 287000, '2027 시행'),
    row('U161', '폐합성수지, 폐합성고무', '소각', 260000, '2021년', '공제조합 소각처리단가(일반)'),
  ];
  const m = mergeNoticeYears(rows);
  assert.deepEqual(m.map((x) => [x.main.id, x.next?.id ?? null]), [['U001', 'U060'], ['U035', 'U096'], ['U161', null]]);
});

test('2027 행만 있으면 그 값이 큰 값, 원문이 조금이라도 다르면 묶지 않음', () => {
  const m = mergeNoticeYears([row('X1', 'B', '처분업자', 1, '2027 시행'), row('X2', 'B ', '처분업자', 2, '2022 적용')]);
  assert.deepEqual(m.map((x) => [x.main.id, x.next?.id ?? null]), [['X1', null], ['X2', null]]);
});

test('2027이 먼저 나와도 2022가 큰 값으로', () => {
  const m = mergeNoticeYears([row('N', 'C', 'm', 2, '2027 시행'), row('O', 'C', 'm', 1, '2022 적용')]);
  assert.deepEqual(m.map((x) => [x.main.id, x.next?.id ?? null]), [['O', 'N']]);
});

test('휴대폰 형식과 가림', () => {
  assert.equal(normalizePhone('01000000000'), '010-0000-0000');
  assert.equal(normalizePhone('010-1234-5678'), '010-1234-5678');
  assert.equal(normalizePhone('02-123-4567'), null);
  assert.equal(maskPhone('010-1234-5678'), '010-****-5678');
});

test('을/를', () => {
  assert.equal(objectParticle('폐합성수지'), '를');
  assert.equal(objectParticle('폐유'), '를');
  assert.equal(objectParticle('분진'), '을');
});
