// 1px 선 표(Figma 07 기대효과 v2 Price Table 279:3746, KPI Table 279:3797, Result 279:3775): 이름 왼쪽, 값 오른쪽, 행마다 1px 선. 카드 없음.
// value가 숫자면 H4 Bold, 글(빈 결과 문구)이면 P2. 설명 문장은 넣지 않는다.
import type { ReactNode } from 'react';
import styles from './impact.module.css';

export type LineRow = { label: ReactNode; value: ReactNode; size?: 'number' | 'text'; strong?: boolean };

export function LineRows({ rows, caption, className }: { rows: LineRow[]; caption: string; className?: string }) {
  return (
    <dl className={[styles.rows, className].filter(Boolean).join(' ')} aria-label={caption}>
      {rows.map((r, i) => (
        <div key={i} className={styles.row}>
          <dt className={r.strong ? styles.rowLabelStrong : styles.rowLabel}>{r.label}</dt>
          <dd className={r.size === 'text' ? styles.rowText : styles.rowValue}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
