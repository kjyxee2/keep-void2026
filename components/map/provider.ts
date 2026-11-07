// 지도 공급자 인터페이스. 화면 코드는 이 인터페이스만 쓰고, 공급자(지금은 OpenStreetMap + Leaflet)는 갈아 끼운다.
// 다른 공급자가 필요해지면 같은 MapProvider를 구현한 파일을 하나 더 두고 MapView에 넘긴다.
import type { MapMethod } from '@/lib/map';
import type { Bounds, LngLat, Pixel } from '@/lib/map-geo';

/** 점 모양(캔버스에 그린다). 원 재활용, 사각 소각, 삼각 매립, 빈 원 미확인, 숫자 원 묶음, 말풍선 처리업체 */
export type Glyph =
  | { kind: 'dot'; method: MapMethod }
  | { kind: 'cluster'; n: number; tier: 's' | 'm' | 'l' }
  | { kind: 'processor'; method: MapMethod; iconSvg: string | null };

export type MarkerSpec = {
  id: string;
  at: LngLat;
  /** 캔버스에 그릴 모양. 스크린리더에는 label만 읽힌다 */
  glyph: Glyph;
  /** 정사각 아이콘 한 변(px). 기준점은 가운데, anchor가 'bottom'이면 아래 가운데 */
  size: number;
  anchor?: 'center' | 'bottom';
  /** 초점을 받는 요소의 aria-label */
  label: string;
  /** 마우스를 올리거나 키보드 초점이 오면 뜨는 툴팁 HTML(이스케이프된 값만) */
  tooltip: string;
  /** Enter, Space, 클릭. 없으면 툴팁을 연다 */
  onActivate?: () => void;
};

export interface OverlayLayer {
  setMarkers(specs: MarkerSpec[]): void;
  /** 레이어 전체 보이기(투명도 전환은 CSS가 맡음). 숨긴 레이어는 초점과 클릭을 받지 않는다 */
  setVisible(visible: boolean, animate?: boolean): void;
  clear(): void;
}

export type MapOptions = {
  bounds: Bounds;
  maxZoom: number;
  minZoom: number;
  /** 바탕 지도 대신 쓸 정적 윤곽(공급자 타일이 실패했을 때) */
  fallback: { url: string; bounds: Bounds };
  /** 오버레이 레이어 클래스(투명도 전환 스타일) */
  overlayClassName: string;
  /** 점마다 두는 투명 초점 버튼 클래스 */
  hitClassName: string;
  tooltipClassName: string;
  /** 지도 영역 이름(스크린리더) */
  label: string;
  zoomInLabel: string;
  zoomOutLabel: string;
};

export interface MapHandle {
  readonly maxZoom: number;
  getZoom(): number;
  /** 현재 확대 단계의 세계 픽셀 좌표 */
  project(at: LngLat): Pixel;
  fitBounds(b: Bounds): void;
  /** 묶음을 풀 만큼 확대(최소 한 단계) */
  zoomInto(b: Bounds): void;
  addOverlay(name: string, zIndex: number): OverlayLayer;
  removeOverlay(layer: OverlayLayer): void;
  /** 확대가 끝날 때마다. 해제 함수를 돌려준다 */
  onZoomEnd(cb: () => void): () => void;
  /** 바탕 타일을 못 받아 정적 윤곽으로 바꿨을 때 한 번 */
  onTileFailure(cb: () => void): () => void;
  showTooltip(at: LngLat, html: string, offsetY: number): void;
  hideTooltip(): void;
  destroy(): void;
}

export interface MapProvider {
  id: string;
  /** 바탕 지도 출처 표기(HTML). 지도 위에 항상 보인다 */
  attribution: string;
  /** signal이 중단되면 지도를 만들지 않고 AbortError로 끝난다(개발 모드 StrictMode의 두 번 마운트 대비) */
  create(el: HTMLElement, opts: MapOptions, signal?: AbortSignal): Promise<MapHandle>;
}
