// 같이 맡기기(Figma v2 76:300): GET /api/groups 묶음 하나를 한 줄로, 원문은 "자세히 보기" 접힘.
// 점은 좌표가 확인된 묶음 공장의 실제 상대 위치(이름 없음), 점선 원은 중심에서 radius_km. 값은 API 원값 그대로.
import { Button } from '@/components/ui/Button';
import { groupCaption, groupDetail, groupSummary, toLocalKm } from '@/lib/result-copy';
import type { GroupItem } from '@/lib/types';
import { Disclosure } from './Disclosure';
import styles from './result.module.css';

/** SVG 좌표계(가로 300, 세로 170). 원 반지름은 세로의 40% */
const W = 300;
const H = 170;
const R = H * 0.4;

export function GroupFit({
  group,
  chipLabel,
  dong,
  onJoin,
}: {
  group: GroupItem;
  chipLabel: string;
  /** 진단에 고른 신고 공장의 동(본인 보기). 없으면 "가까운 공장" */
  dong: string | null;
  onJoin?: () => void;
}) {
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
      <p className={styles.panelBody}>{groupSummary(chipLabel, dong, group.n_factories, group.n_processors)}</p>
      <Disclosure>
        <p className={styles.panelBody}>{groupDetail(chipLabel, group.n_factories, group.radius_km, group.n_processors)}</p>
        {group.label && <p className={styles.small}>{group.label}</p>}
      </Disclosure>
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
          {groupCaption(dots.length)}
          {dots.some((d) => d.self) && '. 네모는 우리 공장'}
        </figcaption>
      </figure>
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
