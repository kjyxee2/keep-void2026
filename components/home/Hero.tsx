// 홈 히어로(Figma 75:150 PC, 75:24 모바일): 사진, 초록 scrim, 헤드라인, 한 문장, 서류 사진으로 시작(주), 사업장 검색(보조)
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import heroPhoto from '@/public/photos/hero_workshop_16x9.png';
import { HeroSearch } from './HeroSearch';
import { ScanIcon } from './icons';
import styles from './Hero.module.css';

export const PHOTO_START_HREF = '/diagnose?start=photo';
export const HERO_ACTIONS_ID = 'home-hero-actions';

export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="home-hero-title">
      <Image
        src={heroPhoto}
        alt=""
        priority
        fetchPriority="high"
        placeholder="blur"
        sizes="100vw"
        className={styles.photo}
      />
      <div className={styles.scrim} aria-hidden="true" />
      <div className={`container ${styles.inner}`}>
        <h1 id="home-hero-title" className={styles.headline}>
          지금 내는 <br className={styles.mobileBreak} />
          폐기물 처리비,
          <br />
          적정한지 확인해 보세요.
        </h1>
        <hr className={styles.rule} />
        <div className={styles.bottom}>
          <p className={styles.sub}>서류 사진 한 장이면 맡기는 곳과 비교할 단가가 나와요.</p>
          <div id={HERO_ACTIONS_ID} className={styles.actions}>
            <Button href={PHOTO_START_HREF} className={styles.cta}>
              <span className={styles.ctaLabel}>
                <ScanIcon />
                서류 사진으로 시작
              </span>
            </Button>
            <HeroSearch />
          </div>
        </div>
      </div>
    </section>
  );
}
