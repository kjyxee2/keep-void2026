// 결과 화면의 접힘(Figma v2 Toggle). 글자 버튼 + aria-expanded, 펼친 내용은 버튼 위에 놓인다.
// 높이는 즉시 바뀌고 펼친 내용만 opacity와 translateY(styles/motion.css .expand-content, 줄임 모드면 0ms).
// 사용자가 누를 때만 움직이므로 자동 연출이 아니다.
'use client';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { DETAIL_TOGGLE } from '@/lib/result-copy';
import styles from './result.module.css';

export function Disclosure({
  label = DETAIL_TOGGLE.open,
  closeLabel = DETAIL_TOGGLE.close,
  children,
}: {
  /** 접혀 있을 때 버튼 글자 */
  label?: string;
  closeLabel?: string;
  children: ReactNode;
}) {
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
    <>
      <div id={contentId} hidden={!open} className={`${styles.expandBody} expand-content`} data-state={entered ? 'after' : 'before'}>
        {children}
      </div>
      <div className={styles.linkRow}>
        <Button variant="text" aria-expanded={open} aria-controls={contentId} onClick={() => setOpen((v) => !v)}>
          {open ? closeLabel : label}
        </Button>
      </div>
    </>
  );
}
