import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assumedAmount, formatWon, monthlyCost, parsePositive, parseRatePct, quoteMonthlyDiff } from './impact-calc.ts';

test('입력 해석: 쉼표 허용, 0과 문자는 null', () => {
  assert.equal(parsePositive('280,000'), 280000);
  assert.equal(parsePositive('2000'), 2000);
  assert.equal(parsePositive('12.5'), 12.5);
  assert.equal(parsePositive(''), null);
  assert.equal(parsePositive('0'), null);
  assert.equal(parsePositive('-5'), null);
  assert.equal(parsePositive('abc'), null);
});

test('우리 공장 한 달 처리비 = 단가 x kg / 1000', () => {
  assert.equal(monthlyCost(280000, 2000), 560000);
  assert.equal(monthlyCost(297000, 1), 297);
  assert.equal(monthlyCost(250000, 333), 83250);
});

test('우리 공장 계산: 값이 하나라도 없으면 결과 없음(기본값으로 채우지 않음)', () => {
  assert.equal(monthlyCost(null, 2000), null);
  assert.equal(monthlyCost(280000, null), null);
  assert.equal(quoteMonthlyDiff(280000, null, 2000), null);
  assert.equal(quoteMonthlyDiff(null, 250000, 2000), null);
  assert.equal(quoteMonthlyDiff(280000, 250000, null), null);
});

test('견적과의 한 달 차이 = (지금 - 견적) x kg / 1000, 견적이 비싸면 음수', () => {
  assert.equal(quoteMonthlyDiff(280000, 250000, 2000), 60000);
  assert.equal(quoteMonthlyDiff(250000, 280000, 2000), -60000);
  assert.equal(quoteMonthlyDiff(280000, 280000, 2000), 0);
});

test('가정 전환율: 0 초과 100 이하, 소수 한 자리', () => {
  assert.equal(parseRatePct('10'), 10);
  assert.equal(parseRatePct('2.5'), 2.5);
  assert.equal(parseRatePct('100'), 100);
  assert.equal(parseRatePct(''), null);
  assert.equal(parseRatePct('0'), null);
  assert.equal(parseRatePct('101'), null);
  assert.equal(parseRatePct('2.55'), null);
  assert.equal(parseRatePct('abc'), null);
});

test('가정 계산기 = 14,695톤 x 전환율 x 28,000원/톤, 입력 전에는 결과 없음', () => {
  assert.equal(assumedAmount(14695, null, 28000), null);
  assert.equal(assumedAmount(14695, 10, 28000), 41146000);
  assert.equal(assumedAmount(14695, 100, 28000), 411460000);
  assert.equal(assumedAmount(14695, 2.5, 28000), 10286500);
});

test('원 표기: 천 단위 쉼표', () => {
  assert.equal(formatWon(41146000), '41,146,000');
  assert.equal(formatWon(-60000), '-60,000');
});
