// 섹션 머리(Figma Editorial/Section Head 265:5502): 라벨 열 + 헤드라인 + 한 문장, 아래 1px 가로선(선택).
// 라벨은 본문보다 작은 글꼴에 sentence case. 섹션당 문장은 하나만. scale: editorial은 Editorial/Headline 56/32, h2는 Pages v2의 H2 40/H5 26.
import type { ReactNode } from 'react';
import { Row } from './Row';
import styles from './SectionHead.module.css';

export function SectionHead({
  label,
  indent,
  headline,
  sentence,
  as: Tag = 'h2',
  id,
  scale = 'h2',
  tone = 'light',
  divider = false,
  className,
}: {
  label?: ReactNode;
  /** 라벨이 없어도 라벨 열을 비워 둔다 */
  indent?: boolean;
  headline?: ReactNode;
  sentence?: ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'p';
  id?: string;
  scale?: 'editorial' | 'h2';
  tone?: 'light' | 'dark';
  divider?: boolean;
  className?: string;
}) {
  return (
    <div className={[styles.head, styles[tone], className].filter(Boolean).join(' ')}>
      <Row label={label} indent={indent} tone={tone}>
        {headline !== undefined && (
          <Tag id={id} className={`${styles.headline} ${styles[scale]}`}>
            {headline}
          </Tag>
        )}
        {sentence !== undefined && <p className={styles.sentence}>{sentence}</p>}
      </Row>
      {divider && <hr className={styles.divider} />}
    </div>
  );
}
