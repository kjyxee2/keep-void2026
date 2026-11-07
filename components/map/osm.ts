// OpenStreetMap 타일 + Leaflet 1.9.4 구현. 이 파일은 MapView(동적 import, SSR 끔)에서만 불러 지도 화면에만 실린다.
// 근거(1.9.4 소스, node_modules/leaflet/src): Renderer는 확대 연출 동안 컨테이너 하나만 transform하고 zoomend, moveend에
// _update를 부른다. 점은 canvas.ts의 DotLayer가 캔버스 하나에 그리고, 점마다 투명 버튼을 두어 Tab, Enter, 툴팁을 받는다.
// Tooltip은 role=tooltip 컨테이너를 만든다.
// 타일 정책(https://operations.osmfoundation.org/policies/tiles/): https 타일 주소 그대로, 출처 표기를 지도 위에 보이게,
// 보이는 칸만 받고 미리 받기 금지(keepBuffer 기본값, 확대 연출 중에는 받지 않음), no-cache 헤더를 붙이지 않음.
import type * as Leaflet from 'leaflet';
import type { Bounds, LngLat } from '@/lib/map-geo';
import { defineDotLayer, readPaint, type DotLayer } from './canvas';
import type { MapHandle, MapOptions, MapProvider, MarkerSpec, OverlayLayer } from './provider';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 기여자';
/** 타일이 하나도 안 오고 이만큼 실패하거나, 이 시간 안에 하나도 안 오면 정적 윤곽으로 바꾼다 */
const FAIL_AFTER_ERRORS = 4;
const FAIL_AFTER_MS = 8000;
/** 마커가 지도 위쪽 이 거리(px) 안이면 툴팁을 아래로 */
const TOOLTIP_FLIP_PX = 170;

const toLatLng = ([lng, lat]: LngLat): [number, number] => [lat, lng];
const toLatLngBounds = (L: typeof Leaflet, [sw, ne]: Bounds) => L.latLngBounds(toLatLng(sw), toLatLng(ne));
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const osmProvider: MapProvider = {
  id: 'osm-leaflet',
  attribution: ATTRIBUTION,
  async create(el: HTMLElement, opts: MapOptions, signal?: AbortSignal): Promise<MapHandle> {
    const L = (await import('leaflet')).default;
    if (signal?.aborted) throw new DOMException('지도 만들기 취소', 'AbortError');
    const reduce = reducedMotion();

    const map = L.map(el, {
      zoomControl: false,
      attributionControl: false,
      maxZoom: opts.maxZoom,
      minZoom: opts.minZoom,
      zoomSnap: 0.5,
      scrollWheelZoom: false, // 페이지 스크롤을 가로채지 않게. 지도를 누르거나 초점이 오면 켠다
      fadeAnimation: false, // 자동 연출 없음
      zoomAnimation: !reduce,
      markerZoomAnimation: !reduce,
    });
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', opts.label);
    L.control
      .zoom({
        position: 'topright',
        zoomInTitle: opts.zoomInLabel,
        zoomOutTitle: opts.zoomOutLabel,
      })
      .addTo(map);
    L.control
      .attribution({
        position: 'bottomright',
        prefix: '<a href="https://leafletjs.com">Leaflet</a>',
      })
      .addTo(map);
    const home = toLatLngBounds(L, opts.bounds);
    map.fitBounds(home, { animate: false });

    // 틀 크기가 바뀌면(첫 배치, 화면 회전, 폭 변경) 크기를 다시 재고, 사용자가 움직이기 전이면 첫 범위에 다시 맞춘다
    let touched = false;
    let fitting = false;
    map.on('dragstart zoomstart', () => {
      if (!fitting) touched = true;
    });
    const resize = new ResizeObserver(() => {
      fitting = true;
      map.invalidateSize({ animate: false });
      if (!touched) map.fitBounds(home, { animate: false });
      fitting = false;
    });
    resize.observe(el);

    const enableWheel = () => map.scrollWheelZoom.enable();
    map.on('click focus', enableWheel);
    map.getContainer().addEventListener('focusin', enableWheel);

    // ---------- 바탕 타일과 실패 대체 ----------
    const failureListeners = new Set<() => void>();
    let loaded = 0;
    let errors = 0;
    let failed = false;
    const tiles = L.tileLayer(TILE_URL, {
      maxZoom: opts.maxZoom,
      attribution: ATTRIBUTION,
      updateWhenZooming: false, // 확대 연출이 끝난 뒤 한 번만 새 칸을 받는다
    });
    const fail = () => {
      if (failed || loaded > 0) return;
      failed = true;
      map.removeLayer(tiles);
      L.imageOverlay(opts.fallback.url, toLatLngBounds(L, opts.fallback.bounds), {
        attribution: ATTRIBUTION,
        interactive: false,
        alt: '',
      }).addTo(map);
      failureListeners.forEach((cb) => cb());
    };
    tiles.on('tileload', () => {
      loaded++;
    });
    tiles.on('tileerror', () => {
      errors++;
      if (errors >= FAIL_AFTER_ERRORS) fail();
    });
    tiles.addTo(map);
    const failTimer = window.setTimeout(fail, FAIL_AFTER_MS);

    // ---------- 공유 툴팁 하나 ----------
    const tooltip = L.tooltip({
      direction: 'top',
      opacity: 1,
      className: opts.tooltipClassName,
    });
    const showTooltip = (at: LngLat, html: string, offsetY: number) => {
      // 위쪽 가장자리 가까이면 아래로 띄워 지도 틀에 잘리지 않게
      const below = map.latLngToContainerPoint(toLatLng(at)).y < TOOLTIP_FLIP_PX;
      tooltip.options.direction = below ? 'bottom' : 'top';
      tooltip.options.offset = L.point(0, below ? offsetY : -offsetY);
      tooltip.setLatLng(toLatLng(at)).setContent(html);
      if (!map.hasLayer(tooltip)) map.openTooltip(tooltip);
      else tooltip.update();
    };
    const hideTooltip = () => {
      if (map.hasLayer(tooltip)) map.closeTooltip(tooltip);
    };

    // ---------- 오버레이 레이어(캔버스 하나 + 점마다 초점 버튼) ----------
    const DotLayerClass = defineDotLayer(L);
    const paint = readPaint(el);
    const overlays = new Set<{
      layer: DotLayer;
      pane: HTMLElement;
      off: () => void;
    }>();

    const addOverlay = (name: string, zIndex: number): OverlayLayer => {
      const pane = map.createPane(name);
      pane.style.zIndex = String(zIndex);
      pane.classList.add(opts.overlayClassName);
      const dots = new DotLayerClass({ pane: name, paint, hitClassName: opts.hitClassName }).addTo(map);

      const offsetOf = (s: MarkerSpec) => (s.anchor === 'bottom' ? s.size : s.size / 2);
      const open = (s: MarkerSpec) => showTooltip(s.at, s.tooltip, offsetOf(s));
      const activate = (s: MarkerSpec) => (s.onActivate ? s.onActivate() : open(s));

      // 버튼마다 리스너를 달지 않고 레이어(pane)에서 한 번에 받는다
      const onOver = (e: Event) => {
        const hit = dots.specOf(e.target);
        if (hit) open(hit.spec);
      };
      const onOut = (e: Event) => {
        const hit = dots.specOf(e.target);
        if (hit && document.activeElement !== hit.el) hideTooltip();
      };
      const onFocus = (e: Event) => onOver(e);
      const onBlur = () => hideTooltip();
      const onKey = (e: KeyboardEvent) => {
        const hit = dots.specOf(e.target);
        if (!hit) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate(hit.spec);
        } else if (e.key === 'Escape') {
          hideTooltip();
        }
      };
      const onClick = (e: Event) => {
        const hit = dots.specOf(e.target);
        if (hit) activate(hit.spec);
      };
      pane.addEventListener('mouseover', onOver);
      pane.addEventListener('mouseout', onOut);
      pane.addEventListener('focusin', onFocus);
      pane.addEventListener('focusout', onBlur);
      pane.addEventListener('keydown', onKey);
      pane.addEventListener('click', onClick);
      const off = () => {
        pane.removeEventListener('mouseover', onOver);
        pane.removeEventListener('mouseout', onOut);
        pane.removeEventListener('focusin', onFocus);
        pane.removeEventListener('focusout', onBlur);
        pane.removeEventListener('keydown', onKey);
        pane.removeEventListener('click', onClick);
      };
      const entry = { layer: dots, pane, off };
      overlays.add(entry);

      const layer: OverlayLayer & { _entry: typeof entry } = {
        _entry: entry,
        setMarkers(list) {
          if (pane.contains(document.activeElement)) hideTooltip();
          dots.setSpecs(list);
        },
        setVisible(visible, animate = true) {
          if (!animate) pane.style.transition = 'none';
          pane.style.opacity = visible ? '1' : '0';
          if (!animate) {
            void pane.offsetWidth; // 전환 없이 바로 적용한 뒤 원래 전환으로
            pane.style.transition = '';
          }
          if (visible) pane.removeAttribute('inert');
          else pane.setAttribute('inert', '');
        },
        clear() {
          dots.clearSpecs();
        },
      };
      return layer;
    };

    const onKeyEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideTooltip();
    };
    el.addEventListener('keydown', onKeyEsc);

    return {
      maxZoom: opts.maxZoom,
      getZoom: () => map.getZoom(),
      project: (at) => map.project(toLatLng(at), map.getZoom()),
      fitBounds: (b) => map.fitBounds(toLatLngBounds(L, b), { animate: !reduce }),
      zoomInto(b) {
        const lb = toLatLngBounds(L, b);
        const fit = map.getBoundsZoom(lb, false, L.point(80, 80));
        const z = Math.min(opts.maxZoom, Math.max(map.getZoom() + 1, fit));
        map.setView(lb.getCenter(), z, { animate: !reduce });
      },
      addOverlay,
      removeOverlay(layer) {
        const entry = (
          layer as OverlayLayer & {
            _entry?: {
              layer: DotLayer;
              pane: HTMLElement;
              off: () => void;
            };
          }
        )._entry;
        if (!entry) return;
        entry.off();
        entry.layer.remove();
        overlays.delete(entry);
      },
      onZoomEnd(cb) {
        map.on('zoomend', cb);
        return () => {
          map.off('zoomend', cb);
        };
      },
      onTileFailure(cb) {
        if (failed) cb();
        failureListeners.add(cb);
        return () => failureListeners.delete(cb);
      },
      showTooltip,
      hideTooltip,
      destroy() {
        window.clearTimeout(failTimer);
        resize.disconnect();
        el.removeEventListener('keydown', onKeyEsc);
        map.getContainer().removeEventListener('focusin', enableWheel);
        overlays.forEach((o) => o.off());
        overlays.clear();
        map.remove();
      },
    };
  },
};
