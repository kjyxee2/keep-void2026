// 같이 맡기기: GET /api/groups 묶음 하나. 점은 좌표가 확인된 묶음 공장의 실제 상대 위치(이름 없음),
// 점선 원은 중심에서 radius_km. 값은 API 원값 그대로.
import { Button } from '@/components/ui/Button';
import { Footnote } from '@/components/ui/Footnote';
import { SOURCE_REPORTS, num, objectParticle, toLocalKm, type GroupItem } from '@/lib/result-copy';
import styles from './result.module.css';

/** SVG 좌표계(가로 300, 세로 170). 원 반지름은 세로의 40% */
const W = 300;
const H = 170;
const R = H * 0.4;

export function GroupFit({ group, chipLabel, onJoin }: { group: GroupItem; chipLabel: string; onJoin?: () => void }) {
  // radius_km는 소수 한 자리로 반올림돼 실제 점이 원 밖에 있을 수 있다. 가장 먼 점까지 그림 안에 들도록 축척을 잡는다
  const local = group.points.map((p) => ({ xy: toLocalKm(p.coordinates, group.center), self: p.self }));
  const far = Math.max(group.radius_km, ...local.map(({ xy: [x, y] }) => Math.hypot(x, y)), 0.01);
  const scale = R / far;
  const ring = group.radius_km * scale;
  const dots = local.map(({ xy: [x, y], self }) => ({ cx: W / 2 + x * scale, cy: H / 2 - y * scale, self }));

  return (
    <section className={styles.panel} aria-labelledby="group-title">
      <h2 id="group-title" className={styles.panelTitle}>
        같이 맡기기
      </h2>
      <p className={styles.panelBody}>
        {chipLabel}
        {objectParticle(chipLabel)} 내는 공장 {num(group.n_factories)}곳이 묶음 중심에서 {group.radius_km}km 안에 있어요. 이
        공장들은 지금 처리업체 {num(group.n_processors)}곳에 따로 맡기고 있어요. 물량을 묶으면 운반과 견적을 한 번에 받을 수
        있어요.
      </p>
      <figure className={styles.groupFigure}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.groupSvg} role="img" aria-label={`묶음 공장 위치 점 ${dots.length}개`}>
          {ring > 0 && <circle cx={W / 2} cy={H / 2} r={ring} className={styles.groupRing} />}
          {dots.map((d, i) =>
            d.self ? (
              <rect key={i} x={d.cx - 5} y={d.cy - 5} width={10} height={10} className={styles.groupSelf} />
            ) : (
              <circle key={i} cx={d.cx} cy={d.cy} r={3.5} className={styles.groupDot} />
            ),
          )}
        </svg>
        <figcaption className={styles.small}>
          위치가 확인된 묶음 공장 {num(dots.length)}곳, 실제 위치(이름 비공개)
          {dots.some((d) => d.self) && '. 네모는 우리 공장'}
        </figcaption>
      </figure>
      {group.label && <p className={styles.small}>{group.label}</p>}
      <Footnote basis="신고 건수">{SOURCE_REPORTS}, 위치 확인 공장 기준</Footnote>
      {onJoin && (
        <div className={styles.linkRow}>
          <Button variant="text" onClick={onJoin}>
            묶음 공장과 같이 견적 받기
          </Button>
        </div>
      )}
    </section>
  );
}
