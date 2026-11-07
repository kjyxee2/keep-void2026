// 숫자 세기: 처음에는 최종 값을 그대로 그린다(서버 렌더, 스크립트 꺼져도 보임).
// to가 바뀌면 이전 값에서 새 값으로 400ms. 줄임 모드면 즉시.
// fromZero: 화면에 들어올 때 0에서 최종 값까지 한 번 센다(800ms). 그 뒤의 변경은 이전 값에서 이어 센다.
'use client';
import { useEffect, useRef, useState } from 'react';
import { animate, inView, useReducedMotion } from 'framer-motion';
import { MOTION } from './tokens';

export function CountUp({
  to,
  decimals = 0,
  suffix = '',
  fromZero = false,
}: {
  to: number;
  /** 소수 자리(예: 80.9%는 1) */
  decimals?: number;
  suffix?: string;
  /** 화면에 들어올 때 0에서 세기 */
  fromZero?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const [value, setValue] = useState(to);
  const [seen, setSeen] = useState(!fromZero);
  const prev = useRef(to);
  const entered = useRef(false);

  useEffect(() => {
    if (!fromZero) return;
    const el = ref.current;
    if (!el) {
      setSeen(true);
      return;
    }
    return inView(el, () => setSeen(true), { amount: 0.5 });
  }, [fromZero]);

  useEffect(() => {
    if (!seen) return;
    let from = prev.current;
    let duration = MOTION.emphasis;
    if (!entered.current) {
      entered.current = true;
      if (fromZero) {
        from = 0;
        duration = MOTION.data;
      }
    }
    prev.current = to;
    if (reduce || from === to) {
      setValue(to);
      return;
    }
    const controls = animate(from, to, {
      duration,
      ease: MOTION.ease,
      onUpdate: (x) => setValue(x),
    });
    return () => controls.stop();
  }, [to, reduce, seen, fromZero]);

  const text = value.toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <span ref={ref} className="count">
      {text}
      {suffix}
    </span>
  );
}
