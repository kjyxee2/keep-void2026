// 안산 공장들이 이 폐기물을 보내는 길: 처리 방식별 신고 비율 막대(API pct 그대로, 합치거나 다시 계산하지 않음).
// 결과 화면의 유일한 자동 연출: 구간마다 scaleX 채움(RouteFills, ScaleXBar와 같은 값 800ms, 80ms 간격). 비율은 글자로 범례에 같이 적는다.
import { Footnote } from '@/components/ui/Footnote';
import { SOURCE_REPORTS, num, objectParticle, routeKind } from '@/lib/result-copy';
import type { RouteShare } from '@/lib/types';
import { RouteFills } from './RouteFills';
import styles from './RouteBar.module.css';

/** 막대 안에 글자를 넣을 최소 비율(%) */
const INLINE_MIN = 8;
/** 모바일 폭에서는 이 비율(%) 미만 구간 글자를 숨긴다(범례에는 그대로 있음) */
const NARROW_MIN = 15;

export function RouteBar({
  chipLabel,
  total,
  rows,
  ownMethod,
}: {
  chipLabel: string;
  total: number;
  rows: RouteShare<'method'>[];
  /** 사용자가 고른 지금 처리 방식. "모름"이면 표시하지 않는다 */
  ownMethod: string | null;
}) {
  const own = ownMethod && ownMethod !== '모름' ? rows.findIndex((r) => r.method === ownMethod) : -1;
  const titleId = 'route-title';
  return (
    <section className={styles.route} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        안산 공장들이 {chipLabel}
        {objectParticle(chipLabel)} 보내는 길 (신고 {num(total)}건)
      </h2>
      <div className={styles.chart}>
        {own >= 0 && (
          <div className={styles.markerRow} aria-hidden="true">
            {rows.map((r, i) => (
              <span key={r.method} className={styles.markerCell} style={{ flexGrow: r.pct }}>
                {i === own && <span className={styles.marker}>우리 공장</span>}
              </span>
            ))}
          </div>
        )}
        <RouteFills
          className={styles.bar}
          cells={rows.map((r) => {
            const k = routeKind(r.method);
            return {
              key: r.method,
              grow: r.pct,
              cellClass: styles.cell,
              fillClass: `${styles.fill} ${styles[k]}`,
              label: r.pct >= INLINE_MIN ? <span className={`${styles.inline} ${styles[`on_${k}`]} ${r.pct < NARROW_MIN ? styles.narrow : ''} count`}>{r.pct}%</span> : undefined,
            };
          })}
        />
      </div>
      <ul role="list" className={styles.legend} aria-label="처리 방식별 신고 비율">
        {rows.map((r, i) => (
          <li key={r.method} className={styles.item}>
            <span className={`${styles.mark} ${styles[`mark_${routeKind(r.method)}`]}`} aria-hidden="true" />
            <span>
              {r.method} <span className="count">{r.pct}%</span>
              {i === own && <span className="sr-only"> (우리 공장 처리 방식)</span>}
            </span>
          </li>
        ))}
      </ul>
      <Footnote basis="신고 건수">{SOURCE_REPORTS}, 신고 건수 기준(톤수 아님)</Footnote>
    </section>
  );
}
