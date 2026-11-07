// 처리업체가 있는 지역 비율(GET /api/dashboard summary.region_pct, 신고 건수 집계). 막대는 장식이고 숫자를 글자로 같이 적는다.
// 자동 연출을 쓰지 않는다(화면의 움직임은 칩 전환 하나). 막대 길이는 비율 그대로(100% = 막대 끝)
import type { CSSProperties } from 'react';
import { Footnote } from '@/components/ui/Footnote';
import styles from './Map.module.css';

export type RegionRow = { label: string; pct: number | null };

const pct = (n: number) => `${n.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export function RegionBars({ rows, total, period }: { rows: RegionRow[]; total: number | null; period: string | null }) {
  return (
    <section className={styles.region} aria-labelledby="region-title">
      <h2 id="region-title" className={styles.regionTitle}>
        처리업체가 있는 지역
        {total !== null && ` (신고 ${total.toLocaleString('ko-KR')}건)`}
      </h2>
      <p className={styles.regionLead}>처리업체 소재지 기준으로 나눈 비중이에요.</p>
      <ul className={styles.bars}>
        {rows.map((r) => (
          <li key={r.label} className={styles.bar}>
            <span>{r.label}</span>
            <span className={styles.barTrack} aria-hidden="true">
              <span
                className={`${styles.barFill} ${r.label === '미확인' ? styles.barUnknown : ''}`}
                style={
                  {
                    '--ratio': r.pct === null ? 0 : Math.min(Math.max(r.pct / 100, 0), 1),
                  } as CSSProperties
                }
              />
            </span>
            <span className={styles.barValue}>{r.pct === null ? '…' : pct(r.pct)}</span>
          </li>
        ))}
      </ul>
      <Footnote basis="신고 건수">안산시 폐기물 배출자 신고현황{period ? ` ${period}` : ''}</Footnote>
    </section>
  );
}
