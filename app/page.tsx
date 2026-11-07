// 홈(Figma 05 Pages v2 01 홈 v2: PC 279:3918, 모바일 279:4060). 사진 우선(2026-11-07): 히어로 첫 동작은 서류 사진, 사업장 검색은 보조.
// 히어로 아래는 편집형 섹션 셋(지금 가는 길, 처리비 점검, 결과 미리보기): 사진 오프너, 한 문장, 띠, 숫자, 어두운 격자(components/editorial).
// 서버에서 칩 통계(home_waste_stats)와 공개 단가(unit_prices)를 읽고 1시간마다 다시 만든다(ISR).
import { Hero, HERO_ACTIONS_ID, PHOTO_START_HREF } from '@/components/home/Hero';
import { PriceCheck } from '@/components/home/PriceCheck';
import { ResultPreview } from '@/components/home/ResultPreview';
import { StickyCta } from '@/components/home/StickyCta';
import { NowRoute } from '@/components/home/NowRoute';
import { loadHomePrices, loadHomeStats } from '@/lib/home-data';
import styles from '@/components/home/home.module.css';

export const revalidate = 3600;

export default async function Home() {
  const [chips, prices] = await Promise.all([loadHomeStats(), loadHomePrices()]);
  return (
    <main id="main" className={styles.main}>
      <Hero />
      <NowRoute chips={chips} photoHref={PHOTO_START_HREF} />
      <PriceCheck rows={prices} />
      <ResultPreview startHref={PHOTO_START_HREF} />
      <StickyCta href={PHOTO_START_HREF} watchId={HERO_ACTIONS_ID} />
    </main>
  );
}
