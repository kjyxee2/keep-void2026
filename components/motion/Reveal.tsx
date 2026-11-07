// 나타남: opacity 0에서 1, translateY 8px에서 0. 한 번만(styles/motion.css [data-motion-reveal], 순서 --i마다 --motion-stagger씩 늦게).
// 화면에 30% 들어오면 data-state를 shown으로 바꾸고 전환은 CSS가 한다. 줄임 모드면 바로 보인다(시간 0).
// 숨김 상태는 html.js 아래에서만이라 스크립트가 꺼져 있으면 바로 보인다(layout의 noscript 스타일도 같은 뜻).
'use client';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useReducedMotion } from './useReducedMotion';

export function Reveal({ children, index = 0, className }: { children: ReactNode; index?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const reduce = useReducedMotion();
  const shown = reduce || inView;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setInView(true);
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-motion-reveal=""
      data-state={shown ? 'shown' : 'before'}
      className={className}
      style={{ '--i': index } as CSSProperties}
    >
      {children}
    </div>
  );
}
