// 업체 바꾸는 절차(Figma 130:1299 접힘, 76:168 펼침). 높이는 즉시 바뀌고, 펼친 내용만 opacity와 translateY 250ms
// (styles/motion.css .expand-content, 줄임 모드면 0ms). 사용자가 누를 때만 움직이므로 자동 연출이 아니다.
'use client';
import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import footnote from '@/components/ui/Footnote.module.css';
import { SWITCH_GUIDE as G } from '@/lib/result-copy';
import styles from './result.module.css';

export function SwitchGuide() {
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const contentId = useId();

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  return (
    <section className={styles.panel} aria-labelledby="guide-title">
      <h2 id="guide-title" className={styles.panelTitle}>
        {G.title}
      </h2>
      <p className={styles.panelBody}>{G.lead}</p>
      <div id={contentId} hidden={!open} className={`${styles.expandBody} expand-content`} data-state={entered ? 'after' : 'before'}>
        <ol role="list" className={styles.steps}>
          {G.steps.map((s, i) => (
            <li key={s.title} className={styles.step}>
              <span className={`${styles.stepNo} count`}>{String(i + 1).padStart(2, '0')}</span>
              <div>
                <p className={styles.stepTitle}>{s.title}</p>
                <p className={styles.stepBody}>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className={styles.designated}>
          <p className={styles.stepTitle}>{G.designated.title}</p>
          <p className={styles.stepBody}>{G.designated.body}</p>
        </div>
        <p className={footnote.footnote}>
          <span className={footnote.basis}>{G.sourceBasis}</span>
          <span className={footnote.source}>{G.source}</span>
        </p>
        <p className={styles.small}>{G.disclaimer}</p>
      </div>
      <div className={styles.linkRow}>
        <Button
          variant="text"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '접기' : `${G.steps.length}단계 보기`}
        </Button>
      </div>
    </section>
  );
}
