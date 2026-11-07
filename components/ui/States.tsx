// 공통 상태: Skeleton(로딩), EmptyState(빈 상태), ErrorState(다시 시도). 문구는 REFIT_motion_handoff.md 3절
'use client';
import type { ReactNode } from 'react';
import { Button } from './Button';
import styles from './States.module.css';

/** 로딩: 화면에는 회색 막대, 스크린리더에는 "불러오는 중이에요" */
export function Skeleton({ lines = 3, label = '불러오는 중이에요' }: { lines?: number; label?: string }) {
  return (
    <div className={styles.skeleton} aria-busy="true">
      <span className="sr-only" aria-live="polite">
        {label}
      </span>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className={styles.line} aria-hidden="true" />
      ))}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.box} role="status">
      <p className={styles.title}>{title}</p>
      {children && <div className={styles.body}>{children}</div>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

export function ErrorState({
  message = '연결이 끊겼어요. 다시 시도해 주세요',
  onRetry,
  retrying = false,
}: {
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div className={`${styles.box} ${styles.error}`} role="alert">
      <p className={styles.title}>{message}</p>
      {onRetry && (
        <div className={styles.action}>
          <Button variant="secondary" onClick={onRetry} loading={retrying} arrow={false}>
            다시 시도
          </Button>
        </div>
      )}
    </div>
  );
}
