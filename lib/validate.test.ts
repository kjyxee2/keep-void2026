import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDiagnosisPatch } from './validate.ts';

test('PATCH accepts current_price_won_per_ton as a non-negative integer (원/톤)', () => {
  assert.deepEqual(validateDiagnosisPatch({ current_price_won_per_ton: 260000 }), [{ current_price_won_per_ton: 260000 }, null]);
  assert.deepEqual(validateDiagnosisPatch({ current_price_won_per_ton: null }), [{ current_price_won_per_ton: null }, null]);
  for (const v of [-1, 1.5, '260000', 3e9]) assert.notEqual(validateDiagnosisPatch({ current_price_won_per_ton: v })[1], null, String(v));
});

test('PATCH still rejects server columns and unpaired lat/lng', () => {
  assert.match(validateDiagnosisPatch({ status: 'completed' })[1] ?? '', /수정할 수 없는 열/);
  assert.match(validateDiagnosisPatch({ lat: 37.3 })[1] ?? '', /lat, lng/);
  assert.equal(validateDiagnosisPatch({ weight_kg_per_month: 2000, current_method: '소각' })[1], null);
});
