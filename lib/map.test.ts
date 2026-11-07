import { test } from 'node:test';
import assert from 'node:assert/strict';
import { factoryMethods, methodBucket } from './map.ts';

const f = (factory_id: string, method: string | null, weight = 1) => ({ factory_id, method, weight });

test('method buckets follow the Figma map rule', () => {
  assert.equal(methodBucket('물질재활용'), '재활용');
  assert.equal(methodBucket('소각'), '소각');
  assert.equal(methodBucket('에너지회수'), '소각');
  assert.equal(methodBucket('매립'), '매립');
  for (const m of ['중간가공(R10)', '복수 허가', '미확인', '기타 중간처분', null]) assert.equal(methodBucket(m), '미확인');
});

test('per factory the bucket with most reports wins, ties 재활용 > 소각 > 매립 > 미확인', () => {
  const m = factoryMethods([
    f('A', '소각', 0.5), f('A', '에너지회수', 0.5), f('A', '물질재활용', 0.5),   // 소각 1 > 재활용 0.5
    f('B', '물질재활용'), f('B', '소각'),                                         // 동률 → 재활용
    f('C', '매립'), f('C', '미확인'),                                             // 동률 → 매립
    f('D', '중간가공(R10)', 2), f('D', '매립'),                                   // 미확인 2 > 매립 1
    f('E', '매립', 0.1), f('E', '매립', 0.2), f('E', '소각', 0.3),   // 0.1+0.2 > 0.3 부동소수 오차여도 동률 → 소각
  ]);
  assert.deepEqual(Object.fromEntries(m), { A: '소각', B: '재활용', C: '매립', D: '미확인', E: '소각' });
});
