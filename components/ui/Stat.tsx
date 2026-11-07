// Figma Stat(71:70): 큰 숫자, 설명, 출처. 숫자는 HTML에 최종 값이 먼저 있다(value에 CountUp을 넣어도 됨)
import type { ReactNode } from 'react';
import { Footnote, type FootnoteBasis } from './Footnote';
import styles from './Stat.module.css';

export function Stat({
  value,
  label,
  basis,
  source,
  surface = 'light',
  className,
}: {
  value: ReactNode;
  label: ReactNode;
  basis: FootnoteBasis;
  source: ReactNode;
  surface?: 'light' | 'dark';
  className?: string;
}) {
  return (
    <div className={[styles.stat, styles[surface], className].filter(Boolean).join(' ')}>
      <p className={`${styles.value} count`}>{value}</p>
      <p className={styles.label}>{label}</p>
      <Footnote basis={basis} surface={surface} className={styles.foot}>
        {source}
      </Footnote>
    </div>
  );
}
