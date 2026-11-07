// 홈 서버 데이터. 서버 컴포넌트 전용(lib/server의 서비스 키를 쓴다). 클라이언트 컴포넌트에서 import 금지.
// 칩 통계: home_waste_stats(GET /api/home-stats와 같은 표). 공개 단가: unit_prices 원문(읽기 전용).
// DB를 못 읽으면 같은 원값(data/home_waste_stats.json, 확인한 단가 원문)으로 그린다. 추정값은 없다.
import fallbackStats from '@/data/home_waste_stats.json';
import { db } from '@/lib/server';
import { HOME_PRICE_IDS, HOME_PRICE_SNAPSHOT, toPriceRows, type HomePriceRow } from './home-prices';
import { HOME_CHIP_IDS, toChipViews, type HomeChipName, type HomeChipView, type HomeStatRow } from './home-stats';

function hasDb() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

export async function loadHomeStats(): Promise<HomeChipView[]> {
  if (hasDb()) {
    try {
      const { data, error } = await db().from('home_waste_stats').select('*').order('chip_id');
      if (!error && data?.length) return toChipViews(data as HomeStatRow[]);
      if (error) console.error('home stats:', error.message);
    } catch (e) {
      console.error('home stats:', (e as Error).message);
    }
  }
  const rows = Object.entries(fallbackStats as Record<string, Omit<HomeStatRow, 'chip_id' | 'name'>>).map(([name, r]) => ({
    ...r,
    name: name as HomeChipName,
    chip_id: HOME_CHIP_IDS[name as HomeChipName],
  }));
  return toChipViews(rows);
}

export async function loadHomePrices(): Promise<HomePriceRow[]> {
  if (hasDb()) {
    try {
      const { data, error } = await db().from('unit_prices').select('id,price_won,year').in('id', [...HOME_PRICE_IDS]);
      if (!error && data?.length) return toPriceRows(data);
      if (error) console.error('home prices:', error.message);
    } catch (e) {
      console.error('home prices:', (e as Error).message);
    }
  }
  return toPriceRows(Object.entries(HOME_PRICE_SNAPSHOT).map(([id, v]) => ({ id, ...v })));
}
