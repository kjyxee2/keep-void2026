// 홈 히어로(Figma 75:150 PC, 75:24 모바일): 화면을 꽉 채우는 밝은 공장 사진 4장 슬라이드(HeroSlides), 왼쪽 빈 벽 위에 어두운 글자.
// 글자는 어절 단위로 순서대로 올라오고(--i 순번, CSS 키프레임), 그 뒤 선, 문장, 두 동작. 사진은 6초마다 교차, 느린 스케일 인, 스크롤 패럴랙스.
// 숨김 상태는 html.js 아래에서만 걸리므로 스크립트가 없으면 글자는 바로 다 보이고 사진은 첫 장만 보인다.
import type { CSSProperties } from 'react';
import { Button } from '@/components/ui/Button';
import photo01 from '@/public/photos/hero_01.jpg';
import photo02 from '@/public/photos/hero_02.jpg';
import photo03 from '@/public/photos/hero_03.jpg';
import photo04 from '@/public/photos/hero_04.jpg';
import { HeroSlides } from './HeroSlides';
import { HeroSearch } from './HeroSearch';
import { ScanIcon } from './icons';
import styles from './Hero.module.css';

export const PHOTO_START_HREF = '/diagnose?start=photo';
export const HERO_ACTIONS_ID = 'home-hero-actions';

/** 헤드라인 세 줄. 문구는 Figma 그대로, 어절마다 순번을 매긴다 */
const HEADLINE_LINES = [['지금', '내는'], ['폐기물', '처리비,'], ['적정한지', '확인해', '보세요.']];
const WORD_COUNT = HEADLINE_LINES.flat().length;

const order = (i: number) => ({ '--i': i }) as CSSProperties;

/** 슬라이드 순서: 창고, 상차장, 컨베이어, 야적장 */
const PHOTOS = [photo01, photo02, photo03, photo04];

export function Hero() {
  let w = 0;
  return (
    <section className={styles.hero} aria-labelledby="home-hero-title">
      <HeroSlides photos={PHOTOS} />
      <div className={`container ${styles.inner}`}>
        <h1 id="home-hero-title" className={styles.headline}>
          {HEADLINE_LINES.map((line, li) => (
            <span key={li} className={styles.line}>
              {line.map((word, wi) => (
                <span key={wi} className={styles.word} style={order(w++)}>
                  {word}
                  {wi < line.length - 1 ? ' ' : ''}
                </span>
              ))}
            </span>
          ))}
        </h1>
        <hr className={styles.rule} style={order(WORD_COUNT)} />
        <div className={styles.bottom}>
          <p className={styles.sub} style={order(WORD_COUNT + 1)}>
            서류 사진 한 장이면 맡기는 곳과 비교할 단가가 나와요.
          </p>
          <div id={HERO_ACTIONS_ID} className={styles.actions}>
            <div className={styles.rise} style={order(WORD_COUNT + 2)}>
              <Button href={PHOTO_START_HREF} className={styles.cta}>
                <span className={styles.ctaLabel}>
                  <ScanIcon />
                  서류 사진으로 시작
                </span>
              </Button>
            </div>
            <div className={`${styles.rise} ${styles.search}`} style={order(WORD_COUNT + 3)}>
              <HeroSearch />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
