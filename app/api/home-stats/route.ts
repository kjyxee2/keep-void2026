import { cached, db, dbFail } from '@/lib/server';

// 홈 칩 통계(결정 2): home_waste_stats 원값 그대로. 신고 건수 집계, 추정 없음
export async function GET() {
  const { data, error } = await db().from('home_waste_stats').select('*').order('chip_id');
  if (error) return dbFail(error);
  return cached({
    chips: data,
    labels: {
      stats: '신고 건수 집계(톤수 아님), 안산시 폐기물 배출자 신고현황 2026-07. 각 행의 basis 참고',
      factories: '공장 수는 해당 처리방식 신고가 하나라도 있는 안산 공장 수',
    },
  });
}
