// 지도 본체. MapExplorer가 next/dynamic(ssr: false)으로만 불러서 Leaflet은 /map에서만, 브라우저에서만 실린다.
'use client';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { MethodIcon, type MethodType } from '@/components/brand/Icon';
import { boundsOf, gridCluster, type Bounds } from '@/lib/map-geo';
import type { MapMethod } from '@/lib/map';
import outline from '@/public/brand/map/banwol_outline.json';
import { clusterSpec, factorySpec, processorSpec, readingOrder, type FactoryFeature, type ProcessorFeature } from './markers';
import { osmProvider } from './osm';
import type { MapHandle, MapProvider, OverlayLayer } from './provider';
import styles from './Map.module.css';

/** 화면 격자 한 칸(px). 이 안에 든 점은 숫자 묶음 하나로. 멀리 볼수록(모바일 첫 화면) 칸을 키워 점이 뭉치지 않게 */
const cellPx = (zoom: number) => (zoom < 12.5 ? 24 : zoom < 13.5 ? 14 : 10);
const MAX_ZOOM = 18;
const MIN_ZOOM = 9;
const FADE_MS = 450;

export const OUTLINE_URL = '/brand/map/banwol_outline.svg';
const OUTLINE_BOUNDS: Bounds = [
  [outline.minLng, outline.minLat],
  [outline.maxLng, outline.maxLat],
];

const ICON_TYPES: MethodType[] = ['재활용', '소각', '매립'];

type Props = {
  bounds: Bounds;
  /** 지금 칩의 공장 점. 바뀌면 점 레이어를 400ms 교차 전환 */
  factories: FactoryFeature[];
  /** factories가 어느 칩 것인지(같은 칩이면 다시 그리지 않음) */
  dataKey: string;
  processors: ProcessorFeature[];
  onTileFailure: () => void;
  onReady: () => void;
  provider?: MapProvider;
};

export default function MapView({ bounds, factories, dataKey, processors, onTileFailure, onReady, provider = osmProvider }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const iconsRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<MapHandle | null>(null);
  const slots = useRef<{
    dots: [OverlayLayer, OverlayLayer];
    processors: OverlayLayer;
    active: 0 | 1;
    key: string | null;
  } | null>(null);
  const dataRef = useRef<FactoryFeature[]>(factories);
  const fadeTimer = useRef<number>(0);
  const [ready, setReady] = useState(false);
  const callbacks = useRef({ onTileFailure, onReady });
  callbacks.current = { onTileFailure, onReady };

  const build = (h: MapHandle, list: FactoryFeature[]) =>
    gridCluster(list, (f) => f.geometry.coordinates, h.project, cellPx(h.getZoom()))
      .map((c) => {
        if (c.items.length === 1) return factorySpec(c.items[0]);
        const canZoom = !c.samePlace && h.getZoom() < h.maxZoom;
        const b = boundsOf(c.items.map((f) => f.geometry.coordinates));
        return clusterSpec(c, canZoom && b ? () => h.zoomInto(b) : undefined);
      })
      .sort(readingOrder);

  // 지도 만들기(한 번)
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const abort = new AbortController();
    let offs: Array<() => void> = [];
    provider
      .create(
        el,
        {
          bounds,
          maxZoom: MAX_ZOOM,
          minZoom: MIN_ZOOM,
          fallback: { url: OUTLINE_URL, bounds: OUTLINE_BOUNDS },
          overlayClassName: styles.overlay,
          tooltipClassName: styles.tooltip,
          label: '이웃 공장 지도. 방향키로 움직이고 더하기, 빼기 키로 확대해요. Tab으로 점을 고르면 이름과 처리 방식이 보여요',
          zoomInLabel: '확대',
          zoomOutLabel: '축소',
        },
        abort.signal,
      )
      .then((h) => {
        if (abort.signal.aborted) return h.destroy();
        handleRef.current = h;
        const dots: [OverlayLayer, OverlayLayer] = [h.addOverlay('refit-dots-a', 600), h.addOverlay('refit-dots-b', 600)];
        dots[1].setVisible(false, false);
        const procs = h.addOverlay('refit-processors', 620);
        slots.current = { dots, processors: procs, active: 0, key: null };
        offs = [
          h.onZoomEnd(() => {
            const s = slots.current;
            if (!s) return;
            window.clearTimeout(fadeTimer.current);
            s.dots[s.active === 0 ? 1 : 0].clear();
            s.dots[s.active].setMarkers(build(h, dataRef.current));
          }),
          h.onTileFailure(() => callbacks.current.onTileFailure()),
        ];
        setReady(true);
        callbacks.current.onReady();
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name !== 'AbortError') callbacks.current.onTileFailure();
      });
    return () => {
      abort.abort();
      offs.forEach((f) => f());
      window.clearTimeout(fadeTimer.current);
      handleRef.current?.destroy();
      handleRef.current = null;
      slots.current = null;
    };
    // 지도는 처음 범위로 한 번만 만든다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 처리업체 마커
  useEffect(() => {
    const s = slots.current;
    const icons = iconsRef.current;
    if (!ready || !s || !icons) return;
    const markup: Partial<Record<MapMethod, string>> = {};
    icons.querySelectorAll<HTMLElement>('[data-method]').forEach((n) => {
      markup[n.dataset.method as MapMethod] = n.innerHTML;
    });
    s.processors.setMarkers(processors.map((p) => processorSpec(p, markup)).sort(readingOrder));
  }, [ready, processors]);

  // 공장 점: 칩이 바뀌면 새 레이어에 그리고 투명도를 교차(사용자가 고른 때만)
  useEffect(() => {
    const s = slots.current;
    const h = handleRef.current;
    if (!ready || !s || !h || s.key === dataKey) return;
    dataRef.current = factories;
    const first = s.key === null;
    s.key = dataKey;
    const prev = s.active;
    const next: 0 | 1 = prev === 0 ? 1 : 0;
    window.clearTimeout(fadeTimer.current);
    h.hideTooltip();
    s.dots[next].setMarkers(build(h, factories));
    if (first) {
      s.dots[next].setVisible(true, false);
      s.dots[prev].setVisible(false, false);
    } else {
      requestAnimationFrame(() => {
        s.dots[next].setVisible(true);
        s.dots[prev].setVisible(false);
      });
    }
    s.active = next;
    fadeTimer.current = window.setTimeout(() => s.dots[prev].clear(), first ? 0 : FADE_MS);
  }, [ready, dataKey, factories]);

  return (
    <>
      <div ref={elRef} className={styles.canvas} data-ready={ready ? '' : undefined} />
      {/* 처리업체 마커와 툴팁에 넣을 처리 방식 아이콘(React 아이콘을 한 번 그려 마크업을 옮긴다) */}
      <div ref={iconsRef} hidden>
        {ICON_TYPES.map((t) => (
          <span key={t} data-method={t}>
            <MethodIcon type={t} size="sm" />
          </span>
        ))}
      </div>
    </>
  );
}
