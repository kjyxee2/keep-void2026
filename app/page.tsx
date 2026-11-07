// 홈(Figma 04 Pages: PC 75:133, 모바일 75:11). 사진 우선(2026-11-07): 히어로 첫 동작은 서류 사진, 사업장 검색은 보조.
// 서버에서 칩 통계(home_waste_stats)와 공개 단가(unit_prices)를 읽고 1시간마다 다시 만든다(ISR).
import { Hero, HERO_ACTIONS_ID, PHOTO_START_HREF } from '@/components/home/Hero';
import { PriceCheck } from '@/components/home/PriceCheck';
import { ResultPreview } from '@/components/home/ResultPreview';
import { StickyCta } from '@/components/home/StickyCta';
import { WasteStats } from '@/components/home/WasteStats';
import { Intro } from '@/components/intro/Intro';
import { loadHomePrices, loadHomeStats } from '@/lib/home-data';
import styles from '@/components/home/home.module.css';

export const revalidate = 3600;

export default async function Home() {
  const [chips, prices] = await Promise.all([loadHomeStats(), loadHomePrices()]);
  return (
    <main id="main" className={styles.main}>
      {/* 첫 진입 인트로: 클라이언트에서만, 세션당 한 번. 서버 HTML에는 없다 */}
      <Intro />
      <Hero />
      <WasteStats chips={chips} photoHref={PHOTO_START_HREF} />
      <PriceCheck rows={prices} />
      <ResultPreview startHref={PHOTO_START_HREF} />
      <StickyCta href={PHOTO_START_HREF} watchId={HERO_ACTIONS_ID} />
    </main>
  );
}
