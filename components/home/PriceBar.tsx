// 처리비 점검 막대. 처음 화면에 들어올 때 한 번 0에서 비율로(800ms, 순서대로 80ms 간격: 이 화면의 유일한 자동 연출).
// 그 뒤 축이 바뀌거나(입력값이 가장 큰 값이 될 때) 우리 공장 값이 바뀌면 400ms로 새 비율까지(사용자 입력 반응).
// transform scaleX만, transform-origin left. 모션 줄이기면 즉시. 스크립트가 꺼져 있으면 layout의 noscript가 --ratio로 그린다.
// 공용 ScaleXBar와 같은 구조에 "반응 전환" 시간만 다르다(공용 컴포넌트는 고치지 않음).
'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { MOTION } from '@/components/motion';

export function PriceBar({ ratio, index = 0, className }: { ratio: number; index?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const [revealed, setRevealed] = useState(false);
  const r = Math.min(Math.max(ratio, 0), 1);

  useEffect(() => {
    if (!inView || revealed) return;
    const t = setTimeout(() => setRevealed(true), (MOTION.data + index * MOTION.stagger) * 1000);
    return () => clearTimeout(t);
  }, [inView, revealed, index]);

  const transition = reduce
    ? { duration: 0 }
    : revealed
      ? { duration: MOTION.emphasis, ease: MOTION.ease }
      : { duration: MOTION.data, delay: index * MOTION.stagger, ease: MOTION.ease };

  return (
    <motion.div
      ref={ref}
      aria-hidden="true"
      data-motion-bar=""
      className={className}
      style={{ transformOrigin: 'left', '--ratio': r } as CSSProperties}
      initial={{ scaleX: 0 }}
      animate={{ scaleX: reduce || inView ? r : 0 }}
      transition={transition}
    />
  );
}
