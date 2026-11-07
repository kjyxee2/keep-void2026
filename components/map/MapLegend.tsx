// Figma Map/Legend. 지도 점과 같은 그림(shapeSvg)을 쓴다. 모양 이름을 글자로 같이 적어 색만으로 뜻을 전하지 않는다
import type { MapMethod } from '@/lib/map';
import { METHOD_LABEL, METHOD_SHAPE, shapeSvg } from './markers';
import styles from './Map.module.css';

const METHODS: MapMethod[] = ['재활용', '소각', '매립', '미확인'];

export function ShapeMark({ method }: { method: MapMethod }) {
  return <span className={styles.mark} dangerouslySetInnerHTML={{ __html: shapeSvg(method) }} />;
}

export function MapLegend() {
  return (
    <ul className={styles.legend} aria-label="지도 범례">
      {METHODS.map((m) => (
        <li key={m} className={styles.legendItem}>
          <ShapeMark method={m} />
          <span>
            {METHOD_LABEL[m]} ({METHOD_SHAPE[m]})
          </span>
        </li>
      ))}
      <li className={styles.legendItem}>
        <span className={styles.legendCluster} aria-hidden="true">
          8
        </span>
        <span>공장 묶음 (숫자는 공장 수, 확대하면 풀림)</span>
      </li>
      <li className={styles.legendItem}>
        <svg viewBox="0 0 32 32" className={styles.legendBubble} aria-hidden="true" focusable="false">
          <path d="M4 1.5h24a2.5 2.5 0 0 1 2.5 2.5v18a2.5 2.5 0 0 1-2.5 2.5h-8L16 30l-4-5.5H4A2.5 2.5 0 0 1 1.5 22V4A2.5 2.5 0 0 1 4 1.5z" />
        </svg>
        <span>처리업체 (아이콘은 처리 방식)</span>
      </li>
    </ul>
  );
}
