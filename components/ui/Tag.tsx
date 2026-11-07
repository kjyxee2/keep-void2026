// Figma Tag(70:106): Recommend(채움), Basis, Warning, Confirmed(왼쪽 막대 + 글자)
import type { ReactNode } from 'react';
import styles from './Tag.module.css';

export type TagTone = 'recommend' | 'basis' | 'warning' | 'confirmed';

export function Tag({ tone = 'basis', children, className }: { tone?: TagTone; children: ReactNode; className?: string }) {
  return (
    <span className={[styles.tag, styles[tone], className].filter(Boolean).join(' ')}>
      {tone !== 'recommend' && <span className={styles.bar} aria-hidden="true" />}
      {children}
    </span>
  );
}
