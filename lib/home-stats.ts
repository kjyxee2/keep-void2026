// 홈 폐기물 칩 통계. 값은 GET /api/home-stats와 같은 home_waste_stats 원값(신고 건수 집계), 화면에서 계산하지 않는다.
// 칩마다 보여 줄 지표 3개는 Figma 칩 프레임대로: 폐합성수지 75:190, 폐수처리오니 121:562, 폐활성탄 121:610, 폐유 121:658
// 순수 함수와 타입만(서버 읽기는 lib/home-data.ts)

export type HomeChipName = '폐합성수지' | '폐수처리오니' | '폐활성탄' | '폐유';

export type HomeStatRow = {
  chip_id: string;
  name: HomeChipName;
  reports: number;
  burn_factories: number;
  recycle_factories: number;
  both_factories: number;
  in_ansan_pct: number | null;
  outside_gyeonggi_pct: number | null;
  region_unknown_pct: number | null;
  recycle_pct: number | null;
  burn_pct: number | null;
};

type StatKey = Exclude<keyof HomeStatRow, 'chip_id' | 'name'>;

/** 화면에 그릴 지표 하나: 값은 원값 그대로, 단위와 설명 문구만 붙인다 */
export type HomeStatView = { key: StatKey; value: number; unit: '곳' | '%'; decimals: 0 | 1; label: string };
export type HomeChipView = { chipId: string; name: HomeChipName; stats: HomeStatView[]; source: string };

const SOURCE_BASE = '안산시 폐기물 배출자 신고현황 2026-07';
const SOURCE_PCT = `${SOURCE_BASE}, 신고 건수 집계 (처리업체 위치 미확인 포함 전체 신고 기준)`;

const LAYOUT: Record<HomeChipName, { source: string; stats: { key: StatKey; label: string }[] }> = {
  폐합성수지: {
    source: SOURCE_BASE,
    stats: [
      { key: 'burn_factories', label: '폐합성수지를 소각, 에너지회수 업체에 맡기는 안산 공장' },
      { key: 'recycle_factories', label: '같은 폐합성수지를 원료 재활용 업체에 맡기는 안산 공장' },
      { key: 'both_factories', label: '같은 폐합성수지를 재활용과 소각 양쪽에 신고한 공장. 바꿔 맡기는 공장이 이미 있어요' },
    ],
  },
  폐수처리오니: {
    source: SOURCE_PCT,
    stats: [
      { key: 'outside_gyeonggi_pct', label: '경기도 밖 처리업체로 가는 폐수처리오니 신고' },
      { key: 'in_ansan_pct', label: '안산 안에서 처리되는 신고' },
      { key: 'recycle_factories', label: '원료 재활용 업체에 맡기는 안산 공장' },
    ],
  },
  폐활성탄: {
    source: SOURCE_PCT,
    stats: [
      { key: 'recycle_pct', label: '원료 재활용으로 가는 폐활성탄 신고' },
      { key: 'outside_gyeonggi_pct', label: '경기도 밖 처리업체로 가는 폐활성탄 신고' },
      { key: 'in_ansan_pct', label: '안산 안에서 처리되는 신고' },
    ],
  },
  폐유: {
    source: SOURCE_PCT,
    stats: [
      { key: 'burn_pct', label: '소각, 에너지회수로 가는 폐유 신고' },
      { key: 'recycle_pct', label: '원료 재활용으로 가는 신고' },
      { key: 'burn_factories', label: '소각, 에너지회수 업체에 맡기는 안산 공장' },
    ],
  },
};

export const HOME_CHIP_ORDER: HomeChipName[] = ['폐합성수지', '폐수처리오니', '폐활성탄', '폐유'];

/** 순수 함수: 행 목록을 칩 화면 모양으로. 값이 없는 지표는 빼고(추정으로 채우지 않음) */
export const HOME_CHIP_IDS: Record<HomeChipName, string> = { 폐합성수지: 'C01', 폐수처리오니: 'C02', 폐활성탄: 'C03', 폐유: 'C04' };

export function toChipViews(rows: HomeStatRow[]): HomeChipView[] {
  const byName = new Map(rows.map((r) => [r.name, r]));
  return HOME_CHIP_ORDER.flatMap((name) => {
    const row = byName.get(name);
    if (!row) return [];
    const stats = LAYOUT[name].stats.flatMap(({ key, label }): HomeStatView[] => {
      const v = row[key];
      if (typeof v !== 'number') return [];
      const pct = key.endsWith('_pct');
      return [{ key, value: v, unit: pct ? '%' : '곳', decimals: pct ? 1 : 0, label }];
    });
    return [{ chipId: row.chip_id, name, stats, source: LAYOUT[name].source }];
  });
}
