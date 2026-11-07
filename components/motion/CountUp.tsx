// 숫자 세기: 처음에는 최종 값을 그대로 그린다(서버 렌더, 스크립트 꺼져도 보임).
// to가 바뀌면 이전 값에서 새 값으로 400ms. 0에서 시작하지 않는다. 줄임 모드면 즉시.
'use client';
import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import { MOTION } from './tokens';

export function CountUp({
  to,
  decimals = 0,
  suffix = '',
}: {
  to: number;
  /** 소수 자리(예: 80.9%는 1) */
  decimals?: number;
  suffix?: string;
}) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(to);
  const prev = useRef(to);

  useEffect(() => {
    const from = prev.current;
    prev.current = to;
    if (reduce || from === to) {
      setValue(to);
      return;
    }
    const controls = animate(from, to, {
      duration: MOTION.emphasis,
      ease: MOTION.ease,
      onUpdate: (x) => setValue(x),
    });
    return () => controls.stop();
  }, [to, reduce]);

  const text = value.toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <span className="count">
      {text}
      {suffix}
    </span>
  );
}
