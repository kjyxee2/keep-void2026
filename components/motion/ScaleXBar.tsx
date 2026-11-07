// 막대: 화면에 들어오면 한 번 scaleX 0에서 비율로(800ms, 순서대로 80ms 간격).
// 화면 진입은 변형되지 않은 부모(막대 칸, 트랙)로 잰다. scaleX(0)인 자기 자신은 면적이 0이라 amount 0.5를 넘지 못한다.
// duration(초)을 주면 첫 연출이 끝난 뒤 비율이 바뀔 때(사용자 입력 반응) 그 시간으로 새 비율까지 간다. 없으면 800ms.
// 장식이므로 aria-hidden. 비율 숫자는 반드시 글자로 옆에 같이 적는다.
// 줄임 모드면 바로 최종 비율(시간 0). 서버와 첫 렌더가 같은 구조라 hydration 뒤에도 값이 맞다.
// 스크립트가 꺼져 있으면 layout의 noscript 스타일이 최종 비율(--ratio)로 보이게 한다.
'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { inView, motion, useReducedMotion } from 'framer-motion';
import { MOTION } from './tokens';

export function ScaleXBar({
  ratio,
  index = 0,
  className,
  duration,
  as = 'div',
}: {
  ratio: number;
  index?: number;
  className?: string;
  /** 첫 연출 뒤 비율이 바뀔 때의 전환 시간(초). 예: MOTION.emphasis */
  duration?: number;
  /** span 안에 둘 때 'span' */
  as?: 'div' | 'span';
}) {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const reduce = useReducedMotion();
  const r = Math.min(Math.max(ratio, 0), 1);

  useEffect(() => {
    const target = ref.current?.parentElement;
    if (!target) {
      setSeen(true);
      return;
    }
    return inView(target, () => setSeen(true), { amount: 0.5 });
  }, []);

  useEffect(() => {
    if (!seen || revealed || duration === undefined) return;
    const t = setTimeout(() => setRevealed(true), (MOTION.data + index * MOTION.stagger) * 1000);
    return () => clearTimeout(t);
  }, [seen, revealed, index, duration]);

  const transition = reduce
    ? { duration: 0 }
    : revealed && duration !== undefined
      ? { duration, ease: MOTION.ease }
      : { duration: MOTION.data, delay: index * MOTION.stagger, ease: MOTION.ease };

  const Tag = as === 'span' ? motion.span : motion.div;
  return (
    <Tag
      ref={ref as never}
      aria-hidden="true"
      data-motion-bar=""
      className={className}
      style={{ transformOrigin: 'left', '--ratio': r } as CSSProperties}
      initial={{ scaleX: 0 }}
      animate={{ scaleX: reduce || seen ? r : 0 }}
      transition={transition}
    />
  );
}
