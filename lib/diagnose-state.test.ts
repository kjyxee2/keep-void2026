import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  confidenceLevel,
  formatWeightInput,
  parseDraft,
  parseWeight,
  weightError,
  weightSourceFromDocument,
} from './diagnose-state.ts';

test('무게: 쉼표를 떼고 정수 kg만 받는다', () => {
  assert.equal(parseWeight('2,480'), 2480);
  assert.equal(parseWeight(' 12 340 '), 12340);
  assert.equal(parseWeight('2.5'), null);
  assert.equal(parseWeight('-3'), null);
  assert.equal(parseWeight('kg'), null);
});

test('무게 오류 문구: 빈 값, 0, 소수, 상한', () => {
  assert.match(weightError('') ?? '', /넣어 주세요/);
  assert.match(weightError('0') ?? '', /0보다 큰/);
  assert.match(weightError('1.5') ?? '', /숫자만/);
  assert.match(weightError('10000001') ?? '', /이하/);
  assert.equal(weightError('2,000'), null);
});

test('입력 중 천 단위 쉼표', () => {
  assert.equal(formatWeightInput('2480'), '2,480');
  assert.equal(formatWeightInput('00120'), '120');
  assert.equal(formatWeightInput('1a2b3'), '123');
  assert.equal(formatWeightInput(''), '');
});

test('확인 정도: docs/api.md 기준 0.85, 0.6', () => {
  assert.deepEqual(confidenceLevel(0.97), { level: 3, text: '또렷하게 읽음' });
  assert.deepEqual(confidenceLevel(0.85), { level: 3, text: '또렷하게 읽음' });
  assert.deepEqual(confidenceLevel(0.6), { level: 2, text: '한 번 더 확인' });
  assert.deepEqual(confidenceLevel(0.3), { level: 1, text: '흐릿함, 꼭 확인' });
  assert.equal(confidenceLevel(undefined), null);
});

test('무게 출처는 서류 종류가 바로 같을 때만', () => {
  assert.equal(weightSourceFromDocument('계량표'), '계량표');
  assert.equal(weightSourceFromDocument('인계서'), '올바로 인계서');
  assert.equal(weightSourceFromDocument('기타'), null);
  assert.equal(weightSourceFromDocument('판독불가'), null);
});

test('저장된 진행 상태: 다른 진단 id, 깨진 값은 버린다', () => {
  const id = '11111111-2222-3333-4444-555555555555';
  const ok = JSON.stringify({ v: 1, diagnosisId: id, chipId: 'C01', step: 3, weight: '2000', weightSource: '계량표',
    method: '소각', processorName: '', factory: null, doc: null, updatedAt: 1 });
  const d = parseDraft(ok, id);
  assert.equal(d?.step, 3);
  assert.equal(d?.weight, '2,000');
  assert.equal(d?.method, '소각');
  assert.equal(parseDraft(ok, 'other'), null);
  assert.equal(parseDraft('{', id), null);
  const bad = parseDraft(JSON.stringify({ v: 1, diagnosisId: id, chipId: 'C01', step: 9, method: '재활용', weightSource: 'x' }), id);
  assert.equal(bad?.step, 2);
  assert.equal(bad?.method, null);
  assert.equal(bad?.weightSource, null);
});
