// 편집형 통계(Figma Editorial/Stat 265:5308): 큰 숫자 하나와 명사구 한 줄. 설명 문장은 쓰지 않는다. 출처가 있는 수치만.
// size l은 Editorial/Number 96, m은 Display 42, h1은 Pages v2 검증 숫자 H1 54, numeral은 홈 숫자 Numeral 70 Medium.
// rule: top은 숫자 위 1px 선(홈 숫자), below는 숫자와 명사구 사이 선(시스템 기본), none은 선 없음.
// 값은 HTML에 최종 값이 먼저 있다(value에 CountUp을 넣어도 됨). note는 작은 출처 한 줄.
import type { ReactNode } from 'react';
import styles from './Stat.module.css';

export function Stat({
  value,
  caption,
  note,
  size = 'm',
  tone = 'accent',
  rule = 'below',
  className,
}: {
  value: ReactNode;
  caption: ReactNode;
  note?: ReactNode;
  size?: 'l' | 'm' | 'h1' | 'numeral';
  tone?: 'accent' | 'brand' | 'primary';
  rule?: 'top' | 'below' | 'none';
  className?: string;
}) {
  return (
    <div className={[styles.stat, styles[`size-${size}`], styles[`tone-${tone}`], styles[`rule-${rule}`], className].filter(Boolean).join(' ')}>
      <p className={`${styles.value} count`}>{value}</p>
      {rule === 'below' && <hr className={styles.divider} />}
      <p className={styles.caption}>{caption}</p>
      {note !== undefined && <p className={styles.note}>{note}</p>}
    </div>
  );
}
