// 선택지 칩 줄(Figma Editorial/Chip Row 265:5756): 공용 Option 5개를 PC에서 1200 폭에 균등 5칸(간격 12), 모바일은 한 열(홈 v2 모바일 279:4090).
// 칩을 카드처럼 키우지 않는다. 자식은 Option 인스턴스.
import type { ReactNode } from 'react';
import styles from './ChipRow.module.css';

export function ChipRow({ legend, children, className }: { legend: string; children: ReactNode; className?: string }) {
  return (
    <fieldset className={[styles.row, className].filter(Boolean).join(' ')}>
      <legend className="sr-only">{legend}</legend>
      {children}
    </fieldset>
  );
}
