// 진단 결과 계산(순수 함수). 금액은 만들지 않는다: 신고 건수 집계와 data/demo/README.md의 순위 규칙만.

export type Flow = {
  factory_id: string | null;
  processor_id: string | null;
  method: string | null;
  method_by_other_group_permit: boolean | null;
  region: string | null;
  waste_type?: string | null;
  waste_group?: string | null;
  weight: number;
};

export type Proc = {
  id: string;
  method: string | null;
  confirmed: boolean | null;
  lat: number | null;
  lng: number | null;
  coord_verified: boolean | null;
};

export type Ranked = {
  rank: number;
  processor_id: string;
  fit_score: number;
  evidence_rows: number;
  distance_km: number | null;
  distance_quality: string | null;
  candidate_confirmed: boolean;
  source: 'fit_candidates' | 'computed';
};

export const EXCLUDED_GROUPS = ['의료폐기물', '그 밖의 폐기물'];   // 추천하지 않음(명세 2-4)
export const EXCLUDED_METHODS = ['복수 허가', '미확인'];          // 후보에서 제외
export const BURN_METHODS = ['소각', '에너지회수'];
const SWITCH: Record<string, number> = { 매립: 1, 소각: 0.8, 에너지회수: 0.6 };
const RECYCLE = '물질재활용';

const round1 = (x: number) => Math.round(x * 10) / 10;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

function share(flows: Flow[], key: (f: Flow) => string | null) {
  const total = flows.reduce((s, f) => s + f.weight, 0);
  const m = new Map<string, number>();
  for (const f of flows) { const k = key(f) ?? '미확인'; m.set(k, (m.get(k) ?? 0) + f.weight); }
  return [...m].sort((a, b) => b[1] - a[1])
    .map(([k, w]) => ({ key: k, reports: round1(w), pct: total ? round1((100 * w) / total) : 0 }));
}

// 그 폐기물군의 신고 경로 분포(weight = 1/k, 합계가 신고 행 수)
export function routeShare(flows: Flow[]) {
  return {
    total_reports: round1(flows.reduce((s, f) => s + f.weight, 0)),
    by_method: share(flows, f => f.method).map(({ key, ...r }) => ({ method: key, ...r })),
    by_region: share(flows, f => f.region).map(({ key, ...r }) => ({ region: key, ...r })),
  };
}

// 칩 집계 기준: 신고 원 표기(waste_chips.waste_types)만 남김. null이면 폐기물군 전체(시드 전 호환)
export function chipFlows(flows: Flow[], wasteTypes: string[] | null | undefined) {
  if (!wasteTypes) return flows;
  const allowed = new Set(wasteTypes);
  return flows.filter(f => allowed.has(f.waste_type ?? ''));
}

// 같은 칩을 재활용으로, 태워서 보내는 안산 공장 수. 본인 공장도 포함(홈 칩 통계와 같은 기준)
export function neighborCounts(flows: Flow[]) {
  const count = (pred: (f: Flow) => boolean) =>
    new Set(flows.filter(f => f.factory_id && pred(f)).map(f => f.factory_id)).size;
  return {
    recycling: count(f => f.method === RECYCLE),
    burning: count(f => BURN_METHODS.includes(f.method ?? '')),
  };
}

// '모름'이면 그 폐기물군 신고 경로에서 weight 합이 가장 큰 방식(명세 2-4)
export function resolveCurrentMethod(current: string, flows: Flow[]) {
  if (current !== '모름') return { method: current, inferred: false };
  return { method: share(flows, f => f.method)[0]?.key ?? '미확인', inferred: true };
}

// fit_candidates 행: 같은 공장, 폐기물군에 현재 처리업체별로 여러 세트가 있을 수 있어 업체 중복을 없애고 상위 3곳
export function pickStored(rows: Array<Omit<Ranked, 'rank' | 'source'>>, procs: Map<string, Proc>): Ranked[] {
  const seen = new Set<string>();
  return rows
    .filter(r => !EXCLUDED_METHODS.includes(procs.get(r.processor_id)?.method ?? '미확인'))
    .sort((a, b) => b.fit_score - a.fit_score || b.evidence_rows - a.evidence_rows)
    .filter(r => !seen.has(r.processor_id) && seen.add(r.processor_id))
    .slice(0, 3)
    .map((r, i) => ({ ...r, rank: i + 1, source: 'fit_candidates' as const }));
}

// fit_candidates에 없을 때 같은 규칙으로 계산(README fit_score)
export function rankComputed(opts: {
  flows: Flow[];
  procs: Map<string, Proc>;
  currentMethod: string;
  origin: { lat: number; lng: number } | null;
  selfFactoryId: string | null;
}): Ranked[] {
  const { flows, procs, currentMethod, origin, selfFactoryId } = opts;
  const evidence = new Map<string, Set<string>>();
  for (const f of flows) {
    if (f.method !== RECYCLE || f.method_by_other_group_permit || !f.processor_id) continue;
    const s = evidence.get(f.processor_id) ?? new Set<string>();
    if (f.factory_id && f.factory_id !== selfFactoryId) s.add(f.factory_id);
    evidence.set(f.processor_id, s);
  }
  const maxE = Math.max(0, ...[...evidence.values()].map(s => s.size));
  const alreadyUsed = new Set(flows.filter(f => selfFactoryId && f.factory_id === selfFactoryId).map(f => f.processor_id));
  const switchGain = SWITCH[currentMethod] ?? 0;

  return [...evidence]
    .filter(([id, s]) => s.size > 0 && !alreadyUsed.has(id) && procs.has(id)
      && !EXCLUDED_METHODS.includes(procs.get(id)!.method ?? '미확인'))
    .map(([id, s]) => {
      const p = procs.get(id)!;
      const located = origin && p.coord_verified && p.lat != null && p.lng != null;
      const distance = located ? round1(haversineKm(origin.lat, origin.lng, p.lat!, p.lng!)) : null;
      const E = maxE ? Math.log(1 + s.size) / Math.log(1 + maxE) : 0;
      const D = distance == null ? 0 : Math.max(0, 1 - distance / 150);
      const M = 0.6 * switchGain + 0.4 * (p.confirmed ? 1 : 0.5);
      return {
        processor_id: id, evidence_rows: s.size, distance_km: distance,
        distance_quality: distance == null ? null : 'A 확인 좌표 간 직선',
        candidate_confirmed: !!p.confirmed, fit_score: round1(100 * (0.5 * E + 0.3 * D + 0.2 * M)),
      };
    })
    .sort((a, b) => b.fit_score - a.fit_score || b.evidence_rows - a.evidence_rows
      || (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity))
    .slice(0, 3)
    .map((r, i) => ({ ...r, rank: i + 1, source: 'computed' as const }));
}

// 결과 화면 공개 단가(unit_prices 원문 행). 무게와 곱하지 않는다.
// C01 폐합성수지: 결정 3의 4개 고정(U001 고시 처분, U035 고시 재활용, U161 공제조합 소각, U176 민간 소각 평균)
// 다른 칩: 그 칩 폐기물군의 '고시 처리단가' 행 + '공제조합 소각처리단가(...)' 행, 공제조합 소각 행이 있을 때만(소각 비교) U176
export const FIXED_PRICE_IDS: Record<string, string[]> = { C01: ['U001', 'U035', 'U161', 'U176'] };
export const BURN_AVG_PRICE_ID = 'U176';
export function referencePriceIds(
  chip: { id: string; waste_group: string | null },
  prices: Array<{ id: string; category: string | null; waste_group: string | null }>,
) {
  if (FIXED_PRICE_IDS[chip.id]) return FIXED_PRICE_IDS[chip.id];
  const own = prices.filter(p => p.waste_group && p.waste_group === chip.waste_group);
  const notice = own.filter(p => p.category === '고시 처리단가');
  const mutual = own.filter(p => p.category?.startsWith('공제조합 소각처리단가'));
  const burnAvg = mutual.length && prices.some(p => p.id === BURN_AVG_PRICE_ID) ? [BURN_AVG_PRICE_ID] : [];
  return [...notice, ...mutual].map(p => p.id).concat(burnAvg).sort();
}

// 영업일 n일 뒤(Asia/Seoul 기준 주말 제외)
// ponytail: 공휴일 미반영. 실제 SLA 운영 시 공휴일 표 추가
export function addBusinessDays(from: Date, n: number) {
  const KST = 9 * 3600_000;
  const d = new Date(from.getTime() + KST);
  while (n > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) n--;
  }
  return new Date(d.getTime() - KST);
}
