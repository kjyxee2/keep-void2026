// 단계 전환: 다음은 오른쪽에서, 이전은 왼쪽에서 translateX 24px + opacity(250ms, 나갈 때 150ms).
// stepKey가 바뀔 때만 움직인다. 줄임 모드면 즉시 교체(시간 0, 같은 구조라 hydration 안전).
'use client';
import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { MOTION } from './tokens';

export function SlideStep({
  stepKey,
  direction = 1,
  children,
  className,
}: {
  stepKey: string | number;
  /** 1: 다음 단계, -1: 이전 단계 */
  direction?: 1 | -1;
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const t = (d: number) => (reduce ? { duration: 0 } : { duration: d, ease: MOTION.ease });
  return (
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <motion.div
        key={stepKey}
        className={className}
        custom={direction}
        variants={{
          enter: (d: number) => ({ x: reduce ? 0 : 24 * d, opacity: reduce ? 1 : 0 }),
          center: { x: 0, opacity: 1, transition: t(MOTION.base) },
          exit: (d: number) => ({ x: reduce ? 0 : -24 * d, opacity: 0, transition: t(MOTION.short) }),
        }}
        initial="enter"
        animate="center"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
