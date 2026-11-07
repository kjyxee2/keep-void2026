// 실행: node --test lib/result-copy.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  candidateEvidence,
  circularBadge,
  groupCaption,
  groupSummary,
  maskPhone,
  mergeNoticeYears,
  normalizePhone,
  objectParticle,
  summaryLines,
} from './result-copy.ts';

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

test('요약 첫 줄: 지금 처리업체 시군을 알 때만 "지금은 {지역}의 {방식} 업체"', () => {
  assert.equal(summaryLines('소각', true)[0], '지금은 소각 업체로 보내고 있어요.');
  assert.equal(summaryLines('소각', true, { sigungu: '평택시' })[0], '지금은 평택시의 소각 업체로 보내고 있어요.');
  assert.equal(summaryLines('에너지회수', false, { sigungu: '안산시' })[0], '지금은 안산시의 에너지회수 업체로 보내고 있어요.');
  assert.equal(summaryLines('소각', true, { sigungu: null })[0], '지금은 소각 업체로 보내고 있어요.');
  assert.equal(summaryLines('소각', true, null)[0], '지금은 소각 업체로 보내고 있어요.');
  assert.equal(summaryLines('모름', true, { sigungu: '평택시' })[0], '지금 처리 방식은 모른다고 하셨어요.');
});

test('완료 화면 배지: 실제 동이 있을 때만 "RE:FIT 순환 공장 {동}"', () => {
  assert.equal(circularBadge('성곡동'), 'RE:FIT 순환 공장 성곡동');
  assert.equal(circularBadge(null), null);
  assert.equal(circularBadge(''), null);
  assert.equal(circularBadge(undefined), null);
});

test('결과 v2 한 줄 문구: 값은 그대로, 동을 모르면 "가까운 공장"', () => {
  assert.equal(groupSummary('폐합성수지', '성곡동', 10, 20), '폐합성수지를 내는 성곡동 공장 10곳, 처리업체 20곳');
  assert.equal(groupSummary('분진', null, 1200, 3), '분진을 내는 가까운 공장 1,200곳, 처리업체 3곳');
  assert.equal(groupCaption(10), '묶음 공장 10곳, 실제 위치 (이름 비공개)');
  assert.equal(candidateEvidence(28), '이 업체에 원료 재활용으로 보내는 안산 공장 28곳');
});
