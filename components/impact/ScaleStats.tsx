// 규모 숫자 4개(Figma 07 기대효과 184:3536). 이 화면의 유일한 자동 연출: 처음 화면에 들어올 때 한 번 0에서 최종 값까지 센다.
// HTML에는 최종 값이 먼저 있다(스크립트가 꺼져도 보임). 처음부터 화면 안에 있으면 세지 않는다(보이는 숫자가 0으로 깜빡이지 않게).
// 모션 줄이기면 세지 않는다. 스크린리더는 세는 동안의 값 대신 최종 값만 읽는다.
'use client';
import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import { MOTION } from '@/components/motion';
import { Stat } from '@/components/ui/Stat';
import styles from './impact.module.css';

export type ScaleItem = { value: number; unit: string; label: string; source: string };

type Phase = 'final' | 'armed' | 'run';

export function ScaleStats({ items }: { items: ScaleItem[] }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('final');
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (reduce || !el || typeof IntersectionObserver === 'undefined') return;
    // 이미 보이는 자리면 연출하지 않는다
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    setPhase('armed');
    setProgress(0);
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setPhase('run');
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduce]);

  useEffect(() => {
    if (phase !== 'run') return;
    const controls = animate(0, 1, {
      duration: MOTION.data,
      ease: MOTION.ease,
      onUpdate: setProgress,
      onComplete: () => setPhase('final'),
    });
    return () => controls.stop();
  }, [phase]);

  const shown = (v: number) => (phase === 'final' ? v : Math.round(v * progress));

  return (
    <div ref={ref} className={styles.scaleGrid}>
      {items.map((it) => (
        <Stat
          key={it.label}
          className={styles.scaleStat}
          value={
            <>
              <span aria-hidden="true">
                {shown(it.value).toLocaleString('ko-KR')}
                {it.unit}
              </span>
              <span className="sr-only">
                {it.value.toLocaleString('ko-KR')}
                {it.unit}
              </span>
            </>
          }
          label={it.label}
          basis="공식 원값"
          source={it.source}
        />
      ))}
    </div>
  );
}
