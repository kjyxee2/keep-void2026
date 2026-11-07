// 막대: 화면에 들어오면 한 번 scaleX 0에서 비율로(800ms, 순서대로 80ms 간격).
// 장식이므로 aria-hidden. 비율 숫자는 반드시 글자로 옆에 같이 적는다.
// 줄임 모드면 바로 최종 비율(시간 0). 서버와 첫 렌더가 같은 구조라 hydration 뒤에도 값이 맞다.
// 스크립트가 꺼져 있으면 layout의 noscript 스타일이 최종 비율(--ratio)로 보이게 한다.
'use client';
import { useRef, type CSSProperties } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { MOTION } from './tokens';

export function ScaleXBar({ ratio, index = 0, className }: { ratio: number; index?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const r = Math.min(Math.max(ratio, 0), 1);

  return (
    <motion.div
      ref={ref}
      aria-hidden="true"
      data-motion-bar=""
      className={className}
      style={{ transformOrigin: 'left', '--ratio': r } as CSSProperties}
      initial={{ scaleX: 0 }}
      animate={{ scaleX: reduce || inView ? r : 0 }}
      transition={reduce ? { duration: 0 } : { duration: MOTION.data, delay: index * MOTION.stagger, ease: MOTION.ease }}
    />
  );
}
