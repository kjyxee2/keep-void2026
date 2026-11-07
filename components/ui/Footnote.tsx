// Figma Footnote(70:131): 출처 종류 라벨 + 출처 본문. 숫자 옆에 항상 붙인다
import type { ReactNode } from 'react';
import styles from './Footnote.module.css';

export type FootnoteBasis = '신고 건수' | '공식 원값' | '직접 입력' | '고시 단가' | '법령, 지침 원문';

const BASIS_LABEL: Record<FootnoteBasis, string> = {
  '신고 건수': '출처 (신고 건수 집계)',
  '공식 원값': '출처 (공식 통계 원값)',
  '직접 입력': '출처 (직접 입력)',
  '고시 단가': '출처 (고시 단가, 실제 계약가 아님)',
  '법령, 지침 원문': '출처 (법령, 지침 원문)',
};

export function Footnote({
  basis,
  children,
  surface = 'light',
  className,
}: {
  basis: FootnoteBasis;
  /** 출처 본문(자료 이름과 기준 시점) */
  children: ReactNode;
  surface?: 'light' | 'dark';
  className?: string;
}) {
  return (
    <p className={[styles.footnote, surface === 'dark' && styles.dark, className].filter(Boolean).join(' ')}>
      <span className={styles.basis}>{BASIS_LABEL[basis]}</span>
      <span className={styles.source}>{children}</span>
    </p>
  );
}
