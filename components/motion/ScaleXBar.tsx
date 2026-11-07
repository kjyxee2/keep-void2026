// 막대: 화면에 들어오면 한 번 scaleX 0에서 비율로(800ms, 순서대로 80ms 간격). 전환은 styles/motion.css [data-motion-bar]가 한다.
// 화면 진입은 변형되지 않은 부모(막대 칸, 트랙)로 잰다. scaleX(0)인 자기 자신은 면적이 0이라 amount 0.5를 넘지 못한다.
// duration(초)을 주면 첫 연출이 끝난 뒤 비율이 바뀔 때(사용자 입력 반응) 그 시간으로 새 비율까지 간다(data-state live, --bar-live). 없으면 800ms.
// 장식이므로 aria-hidden. 비율 숫자는 반드시 글자로 옆에 같이 적는다.
// 줄임 모드면 바로 최종 비율(시간 0). 서버와 첫 렌더가 같은 구조라 hydration 뒤에도 값이 맞다.
// 숨김 상태(scaleX 0)는 html.js 아래에서만이라 스크립트가 꺼져 있으면 최종 비율(--ratio)로 보인다(layout의 noscript 스타일도 같은 뜻).
'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { MOTION } from './tokens';
import { useReducedMotion } from './useReducedMotion';

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
    if (!target || typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setSeen(true);
      },
      { threshold: 0.5 },
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!seen || revealed || duration === undefined) return;
    const t = setTimeout(() => setRevealed(true), (MOTION.data + index * MOTION.stagger) * 1000);
    return () => clearTimeout(t);
  }, [seen, revealed, index, duration]);

  const shown = reduce || seen;
  const state = !shown ? 'before' : revealed && duration !== undefined ? 'live' : 'shown';
  const style = { '--ratio': r, '--i': index, ...(duration !== undefined ? { '--bar-live': `${duration}s` } : {}) } as CSSProperties;
  const Tag = as;
  return <Tag ref={ref as never} aria-hidden="true" data-motion-bar="" data-state={state} className={className} style={style} />;
}
