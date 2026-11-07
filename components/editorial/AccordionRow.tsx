// 펼침 행(Figma Editorial/Accordion Row 265:5590): 상세 내용은 카드 대신 이 행 안에. 제목 + 2px 쉐브론, 위아래 1px 선, 높이 56 이상.
// <details>/<summary>라 키보드(Tab, Enter, Space)와 스크린리더가 기본으로 동작하고 스크립트가 꺼져도 열린다. 기본 닫힘.
// 열릴 때 본문만 opacity, translateY로 나타난다(250ms, 줄임 모드 0ms). 높이는 전환하지 않는다.
import type { ReactNode } from 'react';
import styles from './AccordionRow.module.css';

export function AccordionRow({
  title,
  children,
  size = 'p3',
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  /** 제목 글자 크기: 시스템은 P1, Pages v2의 자세히 보기는 P3, 홈 자세한 기준 보기는 P2 */
  size?: 'p1' | 'p2' | 'p3';
  className?: string;
}) {
  return (
    <details className={[styles.row, styles[size], className].filter(Boolean).join(' ')}>
      <summary className={styles.summary}>
        <span className={styles.title}>{title}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={styles.chevron}
          aria-hidden="true"
          focusable="false"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className={styles.body}>{children}</div>
    </details>
  );
}
