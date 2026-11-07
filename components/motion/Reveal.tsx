// 나타남: opacity 0에서 1, translateY 8px에서 0. 한 번만. 줄임 모드면 처음부터 보인다.
// 스크립트가 꺼져 있으면 layout의 noscript 스타일이 바로 보이게 한다.
'use client';
import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MOTION } from './tokens';

export function Reveal({ children, index = 0, className }: { children: ReactNode; index?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      data-motion-reveal=""
      className={className}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: MOTION.base, delay: index * MOTION.stagger, ease: MOTION.ease }}
    >
      {children}
    </motion.div>
  );
}
