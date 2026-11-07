// 기대효과 페이지 서버 데이터. 서버 컴포넌트 전용(lib/server의 서비스 키를 쓴다). 클라이언트에서 import 금지.
// GET /api/dashboard(app_summary + 앱 집계), GET /api/home-stats(home_waste_stats), unit_prices와 같은 표를 읽는다.
// 데이터를 다시 빌드하면(v3 등) DB 값이 바뀌고 화면도 따라 바뀐다. DB를 못 읽을 때만 아래 원값 스냅샷을 쓴다.
import { db } from '@/lib/server';

export type ImpactData = {
  /** 2024 공식 통계 원값(톤/년), 안산 사업장 배출시설계. app_summary.official_stats_2024_ansan_ton */
  official: { generated: number; consigned: number; landfill: number };
  /** 폐합성수지 위탁소각(톤/년). app_summary에 없는 원값이라 고정(W1, 환경부 2024 전국 폐기물 발생 및 처리현황) */
  plasticBurnTons: number;
  /** 2026-07 신고 건수 집계. app_summary */
  reports: { total: number; sameTypeRows: number; sameTypePct: number; inAnsanPct: number; inAnsanMaterialPct: number };
  /** 폐합성수지 칩 공장 수. home_waste_stats C01 */
  plastic: { burnFactories: number; recycleFactories: number };
  /** 고시 단가 원값(원/톤). unit_prices U001(처분업자), U035(재활용업자) */
  prices: { disposal: number; recycler: number; year: number };
  /** RE:FIT 앱 집계: 재활용 업체로 바꿔 계약, 첫 수거까지 간 연결 요청 수 */
  switched: number;
  /** DB를 읽었는지(false면 스냅샷) */
  live: boolean;
};

// 폐합성수지 위탁소각 톤수: research/32_문제정의_REFIT.md 2-1, W1 원값(2024)
const PLASTIC_BURN_TONS = 14695;

// 안산 안 원료 재활용 비율: app_summary에 아직 필드가 없어 문제정의 2-2 값(2026-07 신고 건수 집계)을 쓴다.
// 데이터 v3 값(2026-11-08 확정, scenario/README.md 기준선 2.1. v2는 2.0). app_summary에 필드가 생기면 그 값을 읽도록 바꾼다
const IN_ANSAN_MATERIAL_PCT = 2.1;

// DB를 못 읽을 때만 쓰는 원값 스냅샷(데이터 v3, 2026-11-08 확정 값)
export const IMPACT_SNAPSHOT: ImpactData = {
  official: { generated: 684718, consigned: 488361, landfill: 155396 },
  plasticBurnTons: PLASTIC_BURN_TONS,
  reports: { total: 4575, sameTypeRows: 1125.7, sameTypePct: 24.6, inAnsanPct: 16.9, inAnsanMaterialPct: IN_ANSAN_MATERIAL_PCT },
  plastic: { burnFactories: 445, recycleFactories: 123 },
  prices: { disposal: 297000, recycler: 269000, year: 2022 },
  switched: 0,
  live: false,
};

function hasDb() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

type Summary = {
  counts?: { flows?: { value?: number } };
  region_pct?: Record<string, { value?: number }>;
  same_type_different_treatment?: { rows?: number; pct?: number };
  official_stats_2024_ansan_ton?: { values?: Record<string, Record<string, number>> };
};

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** 순수 함수: DB 행을 화면 값으로. 빠진 값은 스냅샷 원값(추정으로 채우지 않음) */
export function toImpactData(
  summary: Summary | null,
  plastic: { burn_factories?: number; recycle_factories?: number } | null,
  prices: { id: string; price_won: number; year: number }[],
  switched: number | null,
): ImpactData {
  const s = IMPACT_SNAPSHOT;
  const off = summary?.official_stats_2024_ansan_ton?.values?.['사업장배출시설계'];
  const u001 = prices.find((p) => p.id === 'U001');
  const u035 = prices.find((p) => p.id === 'U035');
  return {
    official: {
      generated: num(off?.['발생량'], s.official.generated),
      consigned: num(off?.['위탁처리'], s.official.consigned),
      landfill: num(off?.['매립'], s.official.landfill),
    },
    plasticBurnTons: PLASTIC_BURN_TONS,
    reports: {
      total: num(summary?.counts?.flows?.value, s.reports.total),
      sameTypeRows: num(summary?.same_type_different_treatment?.rows, s.reports.sameTypeRows),
      sameTypePct: num(summary?.same_type_different_treatment?.pct, s.reports.sameTypePct),
      inAnsanPct: num(summary?.region_pct?.['안산']?.value, s.reports.inAnsanPct),
      inAnsanMaterialPct: IN_ANSAN_MATERIAL_PCT,
    },
    plastic: {
      burnFactories: num(plastic?.burn_factories, s.plastic.burnFactories),
      recycleFactories: num(plastic?.recycle_factories, s.plastic.recycleFactories),
    },
    // 두 단가는 같은 고시 시점일 때만 함께 쓴다. 하나라도 없으면 스냅샷 한 쌍
    prices:
      u001 && u035 && u001.year === u035.year
        ? { disposal: u001.price_won, recycler: u035.price_won, year: u001.year }
        : s.prices,
    switched: num(switched, s.switched),
    live: Boolean(summary),
  };
}

export async function loadImpactData(): Promise<ImpactData> {
  if (!hasDb()) return IMPACT_SNAPSHOT;
  try {
    const [summary, plastic, prices, switched] = await Promise.all([
      db().from('app_summary').select('data').eq('id', 1).maybeSingle(),
      db().from('home_waste_stats').select('burn_factories,recycle_factories').eq('name', '폐합성수지').maybeSingle(),
      db().from('unit_prices').select('id,price_won,year').in('id', ['U001', 'U035']),
      // GET /api/dashboard app.routes_switched_to_recycling과 같은 조건
      db().from('connection_requests').select('*', { count: 'exact', head: true }).in('status', ['contracted', 'first_pickup']),
    ]);
    for (const r of [summary, plastic, prices, switched]) if (r.error) console.error('impact data:', r.error.message);
    return toImpactData(
      (summary.data?.data as Summary | undefined) ?? null,
      plastic.data ?? null,
      prices.data ?? [],
      switched.error ? null : switched.count,
    );
  } catch (e) {
    console.error('impact data:', (e as Error).message);
    return IMPACT_SNAPSHOT;
  }
}
