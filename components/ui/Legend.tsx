// Figma Legend Item(71:51). 색만으로 뜻을 전하지 않도록 처리 방식마다 모양도 다르게 그린다
// (원 재활용, 사각 소각, 삼각 매립, 빈 원 미확인. 지도 점 규칙과 같음)
import styles from './Legend.module.css';

export type LegendType = 'recycle' | 'burn' | 'landfill' | 'factory' | 'unknown';

export const LEGEND_LABEL: Record<LegendType, string> = {
  recycle: '원료 재활용',
  burn: '소각, 에너지회수',
  landfill: '매립',
  factory: '배출 공장',
  unknown: '미확인, 복수 허가',
};

export function LegendMark({ type }: { type: LegendType }) {
  return <span className={`${styles.mark} ${styles[type]}`} aria-hidden="true" />;
}

export function LegendItem({ type, label }: { type: LegendType; label?: string }) {
  return (
    <li className={styles.item}>
      <LegendMark type={type} />
      <span>{label ?? LEGEND_LABEL[type]}</span>
    </li>
  );
}

export function Legend({ types, label = '범례' }: { types: LegendType[]; label?: string }) {
  return (
    <ul role="list" aria-label={label} className={styles.legend}>
      {types.map((t) => (
        <LegendItem key={t} type={t} />
      ))}
    </ul>
  );
}
