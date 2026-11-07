'use client';
// 진단 진행 막대: 단계가 바뀌면 이전 비율에서 새 비율로 scaleX(250ms). 줄임 모드면 바로 최종 비율.
// 막대는 장식이고 같은 뜻을 글자("2 / 3단계")로 적는다
import type { CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MOTION } from '@/components/motion';
import styles from './Diagnose.module.css';

export function Progress({ label, hint, ratio }: { label: string; hint: string; ratio: number }) {
  const reduce = useReducedMotion();
  const r = Math.min(Math.max(ratio, 0), 1);
  return (
    <div className={styles.progress}>
      <div className={styles.progressText}>
        <p className={styles.progressLabel}>{label}</p>
        <p className={styles.progressHint}>{hint}</p>
      </div>
      <div className={styles.progressTrack} aria-hidden="true">
        <motion.div
          className={styles.progressFill}
          data-motion-bar=""
          style={{ transformOrigin: 'left', '--ratio': r } as CSSProperties}
          initial={false}
          animate={{ scaleX: r }}
          transition={reduce ? { duration: 0 } : { duration: MOTION.base, ease: MOTION.ease }}
        />
      </div>
    </div>
  );
}
