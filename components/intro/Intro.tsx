// 홈 첫 진입 인트로: 초록 바탕 위에 심볼이 왼쪽부터 그려지듯 드러나고, 워드마크와 한 줄 소개가 따라온 뒤 전체가 투명해지며 히어로가 드러난다.
// 세션당 한 번(sessionStorage), 줄임 모드와 스크립트 없는 환경에서는 없다. 서버 HTML에는 없고 클라이언트에서만 붙으므로 LCP와 레이아웃이 바뀌지 않는다.
// 시간은 styles/motion.css의 --motion-intro-*가 정하고, 여기서는 끝난 뒤 DOM에서 떼어내는 일과 건너뛰기(클릭, 탭, Enter, Esc)만 맡는다.
'use client';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { MOTION } from '@/components/motion';
import styles from './Intro.module.css';

export const INTRO_SEEN_KEY = 'refit-intro-seen';
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';
export const INTRO_LINE = '안산에서 나온 자원, 다시 안산으로.';

/** 전체 길이(ms). motion.css --motion-intro-exit-delay + --motion-intro-exit와 같은 값. animationend가 안 올 때의 보험 */
const TOTAL_MS = (MOTION.data * 5.25 + MOTION.base * 3.2) * 1000; // 5초
const FALLBACK_MS = TOTAL_MS + MOTION.emphasis * 1000;

type Phase = 'play' | 'skip';

/** 이번 세션에 인트로를 보여 줄지. 저장소가 막혀 있으면 보여 주되 다음 방문 기억은 못 한다 */
function shouldPlay(): boolean {
  if (window.matchMedia(REDUCE_QUERY).matches) return false;
  try {
    if (window.sessionStorage.getItem(INTRO_SEEN_KEY)) return false;
    window.sessionStorage.setItem(INTRO_SEEN_KEY, '1');
  } catch {
    // 저장소 접근 불가(사생활 보호 모드 등): 그냥 한 번 보여 준다
  }
  return true;
}

export function Intro() {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>('play');

  // 수화 직후, 그리기 전에 결정한다(서버 HTML에는 없음)
  useLayoutEffect(() => {
    if (shouldPlay()) setMounted(true);
  }, []);

  const finish = useCallback(() => setMounted(false), []);
  const skip = useCallback(() => setPhase('skip'), []);

  // 재생 중: 본문 스크롤 잠금, 키 입력(Enter, Esc) 건너뛰기, 보험 타이머
  useEffect(() => {
    if (!mounted) return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        skip();
      }
    };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(finish, FALLBACK_MS);
    return () => {
      body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [mounted, skip, finish]);

  if (!mounted) return null;

  return (
    <>
      <div
        className={styles.overlay}
        data-phase={phase}
        aria-hidden="true"
        onClick={skip}
        onAnimationEnd={(e) => {
          // 오버레이 자신의 사라짐 애니메이션이 끝났을 때만(자식 애니메이션 이벤트는 거품처럼 올라온다)
          if (e.target === e.currentTarget) finish();
        }}
      >
        <div className={styles.lockup}>
          <span className={styles.symbol}>
            {/* eslint-disable-next-line @next/next/no-img-element -- 벡터 원본 그대로 */}
            <img src="/brand/logo/refit_symbol.svg" alt="" width={452} height={292} className={styles.symbolImage} />
            <span className={styles.cover} />
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element -- 벡터 원본 그대로 */}
          <img src="/brand/logo/refit_wordmark_inverse.svg" alt="" width={425} height={154} className={styles.wordmark} />
        </div>
        <p className={styles.line}>{INTRO_LINE}</p>
      </div>
      <button type="button" className={styles.skip} data-phase={phase} onClick={skip}>
        <span className="sr-only">인트로 </span>건너뛰기
      </button>
    </>
  );
}
