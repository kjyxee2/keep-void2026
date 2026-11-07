// 이웃 공장 지도(Figma 04 Pages 82:1550 PC, 82:547 모바일). 지도는 MapExplorer 안에서 브라우저에서만 불러온다
import type { Metadata } from 'next';
import { MapExplorer } from '@/components/map/MapExplorer';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: '이웃 공장 지도 | RE:FIT',
  description: '위치가 확인된 안산 배출 공장과 처리업체를 처리 방식별 모양으로 보여 주는 지도. 신고 건수 집계 기준.',
};

export default function MapPage() {
  return (
    <main id="main" className={styles.page}>
      <div className="container">
        <h1 className={`text-title-h4 ${styles.title}`}>안산 공장 폐기물이 지금 가는 길</h1>
        <MapExplorer />
      </div>
    </main>
  );
}
