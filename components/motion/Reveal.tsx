// 나타남: opacity 0에서 1, translateY 8px에서 0. 한 번만. 줄임 모드면 바로 보인다(시간 0).
// 스크립트가 꺼져 있으면 layout의 noscript 스타일이 바로 보이게 한다.
'use client';
import { useRef, type ReactNode } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { MOTION } from './tokens';

export function Reveal({ children, index = 0, className }: { children: ReactNode; index?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduce = useReducedMotion();
  const shown = reduce || inView;
  return (
    <motion.div
      ref={ref}
      data-motion-reveal=""
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      transition={reduce ? { duration: 0 } : { duration: MOTION.base, delay: index * MOTION.stagger, ease: MOTION.ease }}
    >
      {children}
    </motion.div>
  );
}
