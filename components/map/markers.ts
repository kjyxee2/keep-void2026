// Figma Map Overlay(139:1781)의 FactoryDot, Cluster, ProcessorMarker, Tooltip을 DivIcon 마크업으로.
// 처리 방식은 모양과 색을 같이 쓴다(원 재활용, 사각 소각, 삼각 매립, 빈 원 미확인). 흑백에서도 모양으로 구분된다.
import { methodBucket, type MapMethod } from '@/lib/map';
import { clusterSize, type Cluster, type LngLat } from '@/lib/map-geo';
import type { MarkerSpec } from './provider';
import styles from './Map.module.css';

export type FactoryFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    id: string;
    name: string;
    dong: string | null;
    method?: string;
  };
};
export type ProcessorFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    id: string;
    name: string;
    sigungu?: unknown;
    sido?: unknown;
    method?: unknown;
  };
};

export const METHOD_KIND: Record<MapMethod, 'recycle' | 'burn' | 'landfill' | 'unknown'> = {
  재활용: 'recycle',
  소각: 'burn',
  매립: 'landfill',
  미확인: 'unknown',
};
export const METHOD_LABEL: Record<MapMethod, string> = {
  재활용: '원료 재활용',
  소각: '소각, 에너지회수',
  매립: '매립',
  미확인: '미확인, 중간가공, 복수 허가',
};
export const METHOD_SHAPE: Record<MapMethod, string> = {
  재활용: '원',
  소각: '사각',
  매립: '삼각',
  미확인: '빈 원',
};

/** 공장 점 방식: 서버가 준 method(재활용, 소각, 매립, 미확인). 모르는 값은 미확인 */
export const factoryMethod = (m: string | undefined): MapMethod => (m === '재활용' || m === '소각' || m === '매립' ? m : '미확인');

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** 처리 방식 모양(12 x 12). 범례, 툴팁, 지도 점이 같은 그림을 쓴다 */
export function shapeSvg(m: MapMethod, className = styles.shape) {
  const k = METHOD_KIND[m];
  const body =
    k === 'recycle'
      ? '<circle cx="6" cy="6" r="5"/>'
      : k === 'burn'
        ? '<rect x="1.25" y="1.25" width="9.5" height="9.5" rx="1"/>'
        : k === 'landfill'
          ? '<path d="M6 0.8 11.4 10.8H0.6Z"/>'
          : '<circle cx="6" cy="6" r="4.25"/>';
  return `<svg viewBox="0 0 12 12" class="${className} ${styles[k]}" aria-hidden="true" focusable="false">${body}</svg>`;
}

/** 마커 크기(px). 점은 그림 12에 누르기 쉬운 여백, 묶음은 Figma S, M, L */
export const DOT_HIT = 20;
const CLUSTER_PX = { s: 22, m: 28, l: 34 } as const;
const PROCESSOR_PX = 32;

function tooltipHtml(title: string, sub: string | null, markHtml: string, method: string) {
  return (
    `<p class="${styles.ttTitle}">${esc(title)}</p>` +
    (sub ? `<p class="${styles.ttSub}">${esc(sub)}</p>` : '') +
    `<p class="${styles.ttMethod}">${markHtml}<span>${esc(method)}</span></p>`
  );
}

const place = (dong: string | null) => (dong ? `안산시 ${dong}` : '안산시');

export function factorySpec(f: FactoryFeature): MarkerSpec {
  const m = factoryMethod(f.properties.method);
  const { name, dong, id } = f.properties;
  return {
    id,
    at: f.geometry.coordinates,
    html: `<span class="${styles.dot}" data-n="1">${shapeSvg(m)}</span>`,
    className: styles.marker,
    size: DOT_HIT,
    label: `${name}, ${place(dong)}, ${METHOD_LABEL[m]}(${METHOD_SHAPE[m]})`,
    tooltip: tooltipHtml(name, place(dong), shapeSvg(m), METHOD_LABEL[m]),
  };
}

export function clusterSpec(c: Cluster<FactoryFeature>, onZoom: (() => void) | undefined): MarkerSpec {
  const n = c.items.length;
  const size = CLUSTER_PX[clusterSize(n)];
  const names = c.items.slice(0, 4).map((f) => esc(f.properties.name));
  const more = n > 4 ? `<p class="${styles.ttSub}">외 ${n - 4}곳</p>` : '';
  const hint = onZoom ? '누르면 확대돼요' : '같은 건물 좌표를 쓰는 공장이에요';
  return {
    id: `c${c.id}`,
    at: c.at,
    html: `<span class="${styles.cluster} ${styles[`cluster_${clusterSize(n)}`]}" data-n="${n}">${n}</span>`,
    className: styles.marker,
    size,
    label: onZoom ? `공장 ${n}곳 묶음, 누르면 확대` : `같은 건물 공장 ${n}곳`,
    tooltip:
      `<p class="${styles.ttTitle}">공장 ${n}곳</p>` +
      `<ul class="${styles.ttList}">${names.map((x) => `<li>${x}</li>`).join('')}</ul>` +
      more +
      `<p class="${styles.ttSub}">${hint}</p>`,
    onActivate: onZoom,
  };
}

/** methodIcons: MethodIcon 마크업(재활용, 소각, 매립). MapView가 React 아이콘을 한 번 그려 넘긴다 */
export function processorSpec(p: ProcessorFeature, methodIcons: Partial<Record<MapMethod, string>>): MarkerSpec {
  const m = methodBucket(typeof p.properties.method === 'string' ? p.properties.method : null);
  const icon = methodIcons[m] ?? '';
  const where = [p.properties.sido, p.properties.sigungu].filter((x): x is string => typeof x === 'string').join(' ');
  return {
    id: p.properties.id,
    at: p.geometry.coordinates,
    html:
      `<span class="${styles.processor}">` +
      `<svg viewBox="0 0 32 32" class="${styles.bubble}" aria-hidden="true" focusable="false"><path d="M4 1.5h24a2.5 2.5 0 0 1 2.5 2.5v18a2.5 2.5 0 0 1-2.5 2.5h-8L16 30l-4-5.5H4A2.5 2.5 0 0 1 1.5 22V4A2.5 2.5 0 0 1 4 1.5z"/></svg>` +
      `<span class="${styles.processorIcon}">${icon}</span></span>`,
    className: styles.marker,
    size: PROCESSOR_PX,
    anchor: 'bottom',
    label: `처리업체 ${p.properties.name}${where ? `, ${where}` : ''}, ${METHOD_LABEL[m]}`,
    tooltip: tooltipHtml(
      p.properties.name,
      where || null,
      icon ? `<span class="${styles.ttIcon}">${icon}</span>` : shapeSvg(m),
      METHOD_LABEL[m],
    ),
  };
}

/** 키보드 순서: 위(북)에서 아래, 왼쪽에서 오른쪽 */
export const readingOrder = (a: { at: LngLat }, b: { at: LngLat }) => b.at[1] - a.at[1] || a.at[0] - b.at[0];
