// 편집형 행(Figma Editorial/Section Head의 뼈대): PC는 왼쪽 200px 라벨 열(editorial/label-col) + 오른쪽 글 열, 모바일은 한 열.
// 라벨이 없어도 indent를 켜면 라벨 열 자리를 비워 두어 글 열이 같은 선에 선다(Pages v2의 Spacer 200).
import type { ReactNode } from 'react';
import styles from './Row.module.css';

export function Row({
  label,
  indent = false,
  tone = 'light',
  children,
  className,
}: {
  /** 라벨 열 내용(본문보다 한 단계 작은 글꼴, sentence case). 없으면 indent일 때만 빈 열 */
  label?: ReactNode;
  /** 라벨이 없어도 라벨 열 자리를 둔다 */
  indent?: boolean;
  tone?: 'light' | 'dark';
  children: ReactNode;
  className?: string;
}) {
  const hasCol = label !== undefined || indent;
  return (
    <div className={[styles.row, hasCol && styles.withLabel, styles[tone], className].filter(Boolean).join(' ')}>
      {hasCol && <div className={styles.labelCol}>{label !== undefined && <p className={styles.label}>{label}</p>}</div>}
      <div className={styles.textCol}>{children}</div>
    </div>
  );
}
