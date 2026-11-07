// 우리 공장 보고서(/report)용 순수 함수. /api/dashboard summary(Record<string, unknown>)에서 화면에 쓸 값만 꺼낸다.
// 값은 바꾸지 않고, 없으면 null로 두어 화면에서 그 칸을 뺀다(추정 금지).

export type Indicator = { key: 'in' | 'out' | 'same' | 'burn'; value: number; label: string };
export type TrendRow = { period: string; inAnsan: number; outGyeonggi: number; material: number; burn: number };
export type OfficialStats = {
  generated: number;
  rows: { key: 'recycle' | 'burn' | 'landfill' | 'entrusted'; label: string; ton: number }[];
};
export type CitySummary = {
  period: string | null;
  totalReports: number | null;
  indicators: Indicator[];
  trend: TrendRow[];
  official: OfficialStats | null;
};

/** 출처 문구. 공개 자료 이름과 기준 시점만 */
export const SOURCES = {
  reports: (period: string) => `안산시 폐기물 배출자 신고현황 ${period}`,
  trend: (periods: string[]) => `안산시 폐기물 배출자 신고현황 ${periods.join(', ')}`,
  official: '환경부 전국 폐기물 발생 및 처리현황 2024, 안산시',
  app: 'RE:FIT 서비스 기록(앱 실제 집계)',
} as const;

/** 경기 시군 비교는 API에 없어 research/32_문제정의_REFIT.md 2-1([W1] 원값으로 순위 집계) 문구를 그대로 쓴다 */
export const GYEONGGI_LANDFILL_RANK = {
  title: '매립량 경기 31개 시군 중 1위',
  source: '환경부 전국 폐기물 발생 및 처리현황 2024(경기 31개 시군 원값으로 순위 집계)',
} as const;

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const numOrNull = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const at = (o: unknown, ...path: string[]): unknown => path.reduce<unknown>((cur, k) => (isObj(cur) ? cur[k] : undefined), o);

export function parseCitySummary(summary: unknown): CitySummary {
  const period = typeof at(summary, 'meta', 'period') === 'string' ? (at(summary, 'meta', 'period') as string) : null;
  const totalReports = numOrNull(at(summary, 'counts', 'flows', 'value'));

  const material = numOrNull(at(summary, 'burn_vs_material', 'material_pct'));
  const candidates: [Indicator['key'], number | null, string][] = [
    ['in', numOrNull(at(summary, 'region_pct', '안산', 'value')), '안산 안에서 처리되는 신고 경로'],
    ['out', numOrNull(at(summary, 'outside_ansan_pct_of_located', 'value')), '안산 밖으로 나가는 신고 경로(위치 확인 기준)'],
    ['same', numOrNull(at(summary, 'same_type_different_treatment', 'pct')), '같은 종류 폐기물인데 처리 방식이 다른 경로'],
    [
      'burn',
      numOrNull(at(summary, 'burn_vs_material', 'burn_pct')),
      material == null ? '태우는 처리 경로' : `태우는 처리 경로(원료 재활용 ${material.toFixed(1)}%)`,
    ],
  ];
  const indicators = candidates.flatMap(([key, value, label]) => (value == null ? [] : [{ key, value, label }]));

  const values = at(summary, 'trend_2023_2026', 'values');
  const trend: TrendRow[] = isObj(values)
    ? Object.keys(values)
        .sort()
        .flatMap((period) => {
          const v = values[period];
          const row = {
            period,
            inAnsan: numOrNull(at(v, '안산내')),
            outGyeonggi: numOrNull(at(v, '경기밖')),
            material: numOrNull(at(v, '물질재활용')),
            burn: numOrNull(at(v, '소각')),
          };
          return Object.values(row).some((x) => x == null) ? [] : [row as TrendRow];
        })
    : [];

  const off = at(summary, 'official_stats_2024_ansan_ton', 'values', '사업장배출시설계');
  const generated = numOrNull(at(off, '발생량'));
  const offRows: [OfficialStats['rows'][number]['key'], string, string][] = [
    ['recycle', '재활용', '재활용'],
    ['burn', '소각', '소각'],
    ['landfill', '매립', '매립'],
    ['entrusted', '위탁처리', '위탁처리'],
  ];
  const rows = offRows.flatMap(([key, field, label]) => {
    const ton = numOrNull(at(off, field));
    return ton == null ? [] : [{ key, label, ton }];
  });
  const official = generated == null ? null : { generated, rows };

  return { period, totalReports, indicators, trend, official };
}

/** 추이 한 문장. 첫 시점과 마지막 시점의 안산 안 비율 차이(%p, 소수 1자리) */
export function trendSentence(trend: TrendRow[]): { title: string; body: string } | null {
  if (trend.length < 2) return null;
  const a = trend[0];
  const b = trend[trend.length - 1];
  const diff = Math.round((b.inAnsan - a.inAnsan) * 10) / 10;
  const from = `${a.period} ${a.inAnsan.toFixed(1)}%에서 ${b.period} ${b.inAnsan.toFixed(1)}%로`;
  if (diff < 0) return { title: '안산 안 처리가 조금씩 줄고 있어요', body: `${from} ${Math.abs(diff).toFixed(1)}%p 줄었어요.` };
  if (diff > 0) return { title: '안산 안 처리가 조금씩 늘고 있어요', body: `${from} ${diff.toFixed(1)}%p 늘었어요.` };
  return { title: '안산 안 처리 비율이 그대로예요', body: `${from} 같아요.` };
}

// ---------- 이 브라우저의 마지막 완료 진단 ----------

/** lib/api-client.ts tokenStore가 쓰는 키 접두사(refit:anon_token:<진단 id>) */
export const TOKEN_PREFIX = 'refit:anon_token:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 한 번에 확인하는 진단 수(요청 수 제한) */
export const MAX_CHECK = 20;

/** localStorage 키 목록에서 토큰이 있는 진단 id만 */
export function diagnosisIdsFromKeys(keys: string[]): string[] {
  const ids = keys.filter((k) => k.startsWith(TOKEN_PREFIX)).map((k) => k.slice(TOKEN_PREFIX.length));
  return [...new Set(ids.filter((id) => UUID.test(id)))].slice(-MAX_CHECK);
}

/** 완료 시각이 가장 늦은 것. 시각을 읽을 수 없는 항목은 뺀다 */
export function pickLatest<T extends { completed_at: string }>(items: (T | null)[]): T | null {
  let best: T | null = null;
  let bestT = -Infinity;
  for (const it of items) {
    if (!it) continue;
    const t = Date.parse(it.completed_at);
    if (Number.isNaN(t)) continue;
    if (t > bestT) {
      best = it;
      bestT = t;
    }
  }
  return best;
}

/** 진단 완료일(한국 시각, 2026년 11월 8일) */
export function completedDate(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' }).format(t);
}
