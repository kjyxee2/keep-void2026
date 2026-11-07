// 실행: node --test lib/report-data.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnosisIdsFromKeys, parseCitySummary, pickLatest, trendSentence, TOKEN_PREFIX } from './report-data.ts';

const summary = {
  meta: { period: '2026-07' },
  counts: { flows: { value: 4575 } },
  region_pct: { 안산: { value: 16.8 } },
  outside_ansan_pct_of_located: { value: 80.9 },
  same_type_different_treatment: { pct: 24.6 },
  burn_vs_material: { burn_pct: 30, material_pct: 26.9 },
  trend_2023_2026: {
    values: {
      '2026-07': { 안산내: 16.8, 경기밖: 34.5, 물질재활용: 26.9, 소각: 22.9 },
      '2023-07': { 안산내: 18.3, 경기밖: 33.4, 물질재활용: 27.5, 소각: 21.9 },
    },
  },
  official_stats_2024_ansan_ton: {
    values: { 사업장배출시설계: { 발생량: 684718, 재활용: 414313, 소각: 101046, 매립: 155396, 위탁처리: 488361 } },
  },
};

test('summary에서 지표 4개, 추이(시점 순), 2024 공식 통계를 원값 그대로 꺼낸다', () => {
  const s = parseCitySummary(summary);
  assert.equal(s.period, '2026-07');
  assert.equal(s.totalReports, 4575);
  assert.deepEqual(
    s.indicators.map((i) => [i.key, i.value]),
    [['in', 16.8], ['out', 80.9], ['same', 24.6], ['burn', 30]],
  );
  assert.match(s.indicators[3].label, /26\.9%/);
  assert.deepEqual(s.trend.map((t) => t.period), ['2023-07', '2026-07']);
  assert.equal(s.official?.generated, 684718);
  assert.deepEqual(s.official?.rows.map((r) => r.ton), [414313, 101046, 155396, 488361]);
});

test('값이 없으면 지어내지 않고 뺀다', () => {
  const s = parseCitySummary({ region_pct: { 안산: { value: 'x' } }, trend_2023_2026: { values: { '2024-09': { 안산내: 1 } } } });
  assert.deepEqual(s.indicators, []);
  assert.deepEqual(s.trend, []);
  assert.equal(s.official, null);
  assert.equal(parseCitySummary(null).period, null);
});

test('추이 문장: 줄면 줄었다, 차이는 %p 소수 1자리', () => {
  const t = parseCitySummary(summary).trend;
  assert.deepEqual(trendSentence(t), {
    title: '안산 안 처리가 조금씩 줄고 있어요',
    body: '2023-07 18.3%에서 2026-07 16.8%로 1.5%p 줄었어요.',
  });
  assert.equal(trendSentence(t.slice(0, 1)), null);
});

test('토큰 키에서 진단 id만, 중복과 이상한 값은 뺀다', () => {
  const id = '108922fa-96b2-450c-a2b1-5484164c4661';
  assert.deepEqual(diagnosisIdsFromKeys([TOKEN_PREFIX + id, TOKEN_PREFIX + id, TOKEN_PREFIX + '__probe', 'refit:request:x']), [id]);
});

test('완료 시각이 가장 늦은 진단을 고른다', () => {
  const a = { id: 'a', completed_at: '2026-11-07T10:00:00Z' };
  const b = { id: 'b', completed_at: '2026-11-08T10:00:00Z' };
  assert.equal(pickLatest([a, null, b, { id: 'c', completed_at: 'bad' }])?.id, 'b');
  assert.equal(pickLatest([null]), null);
});
