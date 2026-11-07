// 히어로 사진 슬라이드: 4장을 2초(--motion-dwell)마다 교차(opacity만, --motion-slow 800ms). 새로 보이는 장이 위에서 나타나고 느린 확대(1.04에서 1, 2초)를 같이 시작한다.
// 글자와 버튼은 그대로, 사진만 바뀐다. 장식용이라 alt="" 와 aria-hidden. 자동 전환이라 멈춤 버튼 하나를 둔다(WCAG 2.2.2).
// 줄임 모드는 첫 장 고정. 탭이 숨겨지면 멈추고 돌아오면 다시 돈다. 스크립트가 없으면 첫 장만 보인다(나머지는 html.js 아래에서만 겹침).
// 사진 틀(.media)은 스크롤에 따라 translateY로 천천히 따라 내려온다(패럴랙스, 위쪽 12% 여유). rAF 하나, passive scroll, transform만.
'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Image, { type StaticImageData } from 'next/image';
import { MOTION, useReducedMotion } from '@/components/motion';
import styles from './Hero.module.css';

/** 한 장이 머무는 시간(ms). styles/motion.css --motion-dwell과 같은 값 */
const DWELL_MS = MOTION.dwell * 1000;
/** 스크롤 거리 중 사진이 따라 내려오는 비율. CSS .media의 위쪽 여유(12%)와 같다 */
const PARALLAX_RATIO = 0.12;

export function HeroSlides({ photos }: { photos: StaticImageData[] }) {
  const reduce = useReducedMotion();
  const mediaRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  // 방금 물러난 장: 새 장이 다 나타날 때까지 아래에 그대로 둔다(겹치는 동안 바탕이 비치지 않게)
  const [leaving, setLeaving] = useState<number | null>(null);
  const [hidden, setHidden] = useState(false);
  const running = !reduce && !hidden && photos.length > 1;

  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === 'hidden');
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setActive((i) => {
        setLeaving(i);
        return (i + 1) % photos.length;
      });
    }, DWELL_MS);
    return () => clearInterval(t);
  }, [running, photos.length]);

  // 물러난 장은 교차 시간(--motion-slow = emphasis의 두 배)이 지나면 투명으로. 이미 새 장에 가려져 있어 보이지 않는다
  useEffect(() => {
    if (leaving === null) return;
    const t = setTimeout(() => setLeaving(null), MOTION.emphasis * 2 * 1000 + 100);
    return () => clearTimeout(t);
  }, [leaving]);

  // 패럴랙스
  useEffect(() => {
    const el = mediaRef.current;
    if (!el || reduce) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const hero = el.closest('section') ?? el;
      const limit = hero.getBoundingClientRect().height;
      const y = Math.min(Math.max(window.scrollY, 0), limit) * PARALLAX_RATIO;
      el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
      el.style.transform = '';
    };
  }, [reduce]);

  return (
    <>
      <div className={styles.frame} aria-hidden="true">
        <div ref={mediaRef} className={styles.media}>
          {photos.map((photo, i) => (
            <div
              key={i}
              className={styles.layer}
              data-active={i === active || undefined}
              data-leaving={i === leaving || undefined}
            >
              <Image
                src={photo}
                alt=""
                priority={i === 0}
                fetchPriority={i === 0 ? 'high' : undefined}
                loading={i === 0 ? undefined : 'lazy'}
                placeholder="blur"
                sizes="100vw"
                className={styles.photo}
              />
            </div>
          ))}
        </div>
        <div className={styles.veil} />
      </div>
    </>
  );
}
