// RouteBar 구간 채움. ScaleXBar와 같은 값(800ms, 80ms 간격, transformOrigin left, 한 번, 줄임 모드 0ms)이지만
// 화면 진입은 변형되지 않은 막대 줄(부모)로 잰다. ScaleXBar는 scaleX(0)인 자기 자신을 관찰해서 면적이 0이라
// amount 0.5를 넘지 못하고 멈추는 구간이 생긴다(공용 컴포넌트 수정 요청 대상).
'use client';
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { MOTION } from '@/components/motion';

export function RouteFills({
  className,
  cells,
}: {
  className: string;
  cells: { key: string; grow: number; cellClass: string; fillClass: string; label?: ReactNode }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  return (
    <div ref={ref} className={className} aria-hidden="true">
      {cells.map((c, i) => (
        <span key={c.key} className={c.cellClass} style={{ flexGrow: c.grow }}>
          <motion.span
            data-motion-bar=""
            className={c.fillClass}
            style={{ transformOrigin: 'left', '--ratio': 1 } as CSSProperties}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: reduce || inView ? 1 : 0 }}
            transition={reduce ? { duration: 0 } : { duration: MOTION.data, delay: i * MOTION.stagger, ease: MOTION.ease }}
          />
          {c.label}
        </span>
      ))}
    </div>
  );
}
