// 점 레이어를 캔버스 하나에 그린다(Leaflet 1.9.4 Renderer를 상속). 점마다 DOM 마커를 만들지 않아
// 확대, 축소 뒤 다시 그리는 비용이 요소 수백 개 생성에서 캔버스 그리기 한 번으로 준다.
// 키보드와 보조기기용으로는 점마다 투명한 버튼 하나만 둔다(모양은 캔버스, 초점 고리는 버튼).
// 모양 언어는 markers.ts와 같다: 원 재활용, 사각 소각, 삼각 매립, 빈 원 미확인, 숫자 원 묶음, 말풍선 처리업체.
import type * as Leaflet from 'leaflet';
import type { MapMethod } from '@/lib/map';
import type { Glyph, MarkerSpec } from './provider';

/** Figma Map Overlay 토큰. 캔버스는 CSS 변수를 못 읽어서 지도 틀에서 한 번 계산해 둔다 */
export type Paint = {
  recycle: string;
  burn: string;
  landfill: string;
  page: string;
  brand: string;
  inverse: string;
  strong: string;
  text: string;
  /** 점 그림 한 변(px, --space-14) */
  shape: number;
  /** 묶음 숫자 글꼴(px, --font-size-p4와 p3) */
  fontS: number;
  fontL: number;
  fontFamily: string;
  fontWeight: string;
  /** 묶음 테두리(px, --border-width-2) */
  ring: number;
};

const px = (v: string, fallback: number) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

export function readPaint(el: HTMLElement): Paint {
  const cs = getComputedStyle(el);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    recycle: v('--color-chart-recycle'),
    burn: v('--color-chart-burn'),
    landfill: v('--color-chart-landfill'),
    page: v('--color-bg-page'),
    brand: v('--color-bg-brand'),
    inverse: v('--color-text-inverse'),
    strong: v('--color-border-strong'),
    text: v('--color-text-primary'),
    shape: px(v('--space-14'), 14),
    fontS: px(v('--font-size-p4'), 14),
    fontL: px(v('--font-size-p3'), 16),
    fontFamily: cs.fontFamily,
    fontWeight: v('--font-weight-bold') || '700',
    ring: px(v('--border-width-2'), 2),
  };
}

/** 처리업체 말풍선(markers.ts, MapLegend와 같은 32 x 32 경로) */
export const BUBBLE_PATH = 'M4 1.5h24a2.5 2.5 0 0 1 2.5 2.5v18a2.5 2.5 0 0 1-2.5 2.5h-8L16 30l-4-5.5H4A2.5 2.5 0 0 1 1.5 22V4A2.5 2.5 0 0 1 4 1.5z';

/** 처리 방식 아이콘(React MethodIcon 마크업)을 캔버스에 그릴 그림으로. 색은 currentColor라 svg에 color를 준다 */
function iconImage(svg: string, color: string, sizePx: number): HTMLImageElement {
  const sized = svg.replace(/^<svg/, `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" color="${color}"`);
  const img = new Image(sizePx, sizePx);
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
  return img;
}

export interface DotLayer extends Leaflet.Layer {
  setSpecs(specs: MarkerSpec[]): void;
  clearSpecs(): void;
  /** 초점 버튼 요소에서 그 점의 스펙 */
  specOf(target: EventTarget | null): { el: HTMLElement; spec: MarkerSpec } | null;
}

type DotLayerOptions = Leaflet.RendererOptions & {
  pane: string;
  paint: Paint;
  /** 초점 버튼 클래스(Map.module.css .hit) */
  hitClassName: string;
};

type Internals = {
  _map: Leaflet.Map;
  _container: HTMLElement;
  _bounds: { min: Leaflet.Point; getSize(): Leaflet.Point };
  _canvas: HTMLCanvasElement;
  _hitsEl: HTMLElement;
  _ctx: CanvasRenderingContext2D;
  _placedZoom: number | null;
  _frame: number;
  _specs: MarkerSpec[];
  _pts: Float64Array;
  _hits: Map<string, HTMLButtonElement>;
  _bySpec: WeakMap<Element, MarkerSpec>;
  _icons: Map<string, HTMLImageElement>;
  _paint: Paint;
  _dpr: number;
  options: DotLayerOptions;
  setSpecs(specs: MarkerSpec[]): void;
  _update(): void;
  _draw(): void;
  _place(): void;
  _syncHits(): void;
  _icon(svg: string): HTMLImageElement;
};

type DotLayerCtor = new (options: DotLayerOptions) => DotLayer;

export function defineDotLayer(L: typeof Leaflet): DotLayerCtor {
  const Base = L.Renderer as unknown as { extend(props: Record<string, unknown>): DotLayerCtor };
  const proto = L.Renderer.prototype as unknown as { _update(): void; onAdd(map: Leaflet.Map): void; onRemove(): void };

  return Base.extend({
    options: { padding: 0.1 },

    initialize(this: Internals & Leaflet.Renderer, options: DotLayerOptions) {
      L.Util.setOptions(this, options);
      L.Util.stamp(this);
      (this as unknown as { _layers: Record<string, unknown> })._layers = {};
      this._specs = [];
      this._pts = new Float64Array(0);
      this._placedZoom = null;
      this._frame = 0;
      this._hits = new Map();
      this._bySpec = new WeakMap();
      this._icons = new Map();
      this._paint = options.paint;
    },

    _initContainer(this: Internals) {
      const container = (this._container = document.createElement('div'));
      container.className = 'leaflet-layer';
      const canvas = (this._canvas = document.createElement('canvas'));
      canvas.style.position = 'absolute';
      canvas.style.left = '0';
      canvas.style.top = '0';
      canvas.style.pointerEvents = 'none'; // 다른 레이어의 버튼을 가리지 않게. 마우스와 초점은 버튼이 받는다
      canvas.setAttribute('aria-hidden', 'true');
      container.appendChild(canvas);
      // 초점 버튼은 레이어 좌표로 한 번 놓고, 이 상자만 캔버스 원점에 맞춰 옮긴다
      const hits = (this._hitsEl = document.createElement('div'));
      hits.style.position = 'absolute';
      hits.style.left = '0';
      hits.style.top = '0';
      container.appendChild(hits);
      this._ctx = canvas.getContext('2d')!;
      this._dpr = Math.min(3, window.devicePixelRatio || 1);
    },

    _destroyContainer(this: Internals) {
      cancelAnimationFrame(this._frame);
      this._container.remove();
      this._hits.clear();
    },

    onAdd(this: Internals & Leaflet.Renderer, map: Leaflet.Map) {
      proto.onAdd.call(this, map);
      // 묶음 숫자 글꼴(Pretendard)이 늦게 오면 한 번 다시 그린다
      document.fonts?.ready.then(() => this._map && this._draw());
    },

    onRemove(this: Internals & Leaflet.Renderer) {
      proto.onRemove.call(this);
    },

    setSpecs(this: Internals, specs: MarkerSpec[]) {
      this._specs = specs;
      this._pts = new Float64Array(specs.length * 2);
      this._placedZoom = null;
      this._syncHits();
      if (!this._map || !this._bounds) return;
      this._place();
      // zoomend 직후에는 moveend의 _update가 바로 그리므로 다음 프레임 그리기는 거기서 취소된다
      cancelAnimationFrame(this._frame);
      this._frame = requestAnimationFrame(() => {
        this._frame = 0;
        this._draw();
      });
    },

    clearSpecs(this: Internals) {
      this.setSpecs([]);
    },

    specOf(this: Internals, target: EventTarget | null) {
      const el = (target as Element | null)?.closest?.(`.${this.options.hitClassName}`) as HTMLElement | null;
      const spec = el ? this._bySpec.get(el) : undefined;
      return el && spec ? { el, spec } : null;
    },

    /** 점마다 버튼 하나. id가 같은 버튼은 그대로 두고 라벨만 맞춘다 */
    _syncHits(this: Internals) {
      const keep = new Set<string>();
      const frag = document.createDocumentFragment();
      for (const s of this._specs) {
        keep.add(s.id);
        let b = this._hits.get(s.id);
        if (!b) {
          b = document.createElement('button');
          b.type = 'button';
          b.className = this.options.hitClassName;
          this._hits.set(s.id, b);
        }
        if (b.getAttribute('aria-label') !== s.label) b.setAttribute('aria-label', s.label);
        b.style.width = `${s.size}px`;
        b.style.height = `${s.size}px`;
        this._bySpec.set(b, s);
        frag.appendChild(b); // 읽기 순서(북에서 남)대로 다시 붙인다
      }
      for (const [id, b] of this._hits) {
        if (!keep.has(id)) {
          this._hits.delete(id);
          b.remove();
        }
      }
      this._hitsEl.appendChild(frag);
    },

    _update(this: Internals) {
      if ((this._map as unknown as { _animatingZoom?: boolean })._animatingZoom && this._bounds) return;
      proto._update.call(this);
      const b = this._bounds;
      const size = b.getSize();
      const canvas = this._canvas;
      const m = this._dpr;
      L.DomUtil.setPosition(this._container, b.min);
      const w = Math.round(m * size.x);
      const h = Math.round(m * size.y);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = `${size.x}px`;
        canvas.style.height = `${size.y}px`;
      }
      this._hitsEl.style.transform = `translate(${-b.min.x}px, ${-b.min.y}px)`;
      if (this._placedZoom !== this._map.getZoom()) this._place();
      cancelAnimationFrame(this._frame);
      this._frame = 0;
      this._draw();
    },

    /** 지금 확대 단계의 레이어 좌표를 계산하고 버튼을 옮긴다(확대 단계나 점이 바뀔 때만) */
    _place(this: Internals) {
      const map = this._map;
      const pts = this._pts;
      this._specs.forEach((s, i) => {
        const p = map.latLngToLayerPoint([s.at[1], s.at[0]]);
        pts[i * 2] = p.x;
        pts[i * 2 + 1] = p.y;
        const b = this._hits.get(s.id);
        if (!b) return;
        const top = s.anchor === 'bottom' ? p.y - s.size : p.y - s.size / 2;
        b.style.transform = `translate(${p.x - s.size / 2}px, ${top}px)`;
      });
      this._placedZoom = map.getZoom();
    },

    _icon(this: Internals, svg: string) {
      let img = this._icons.get(svg);
      if (!img) {
        img = iconImage(svg, this._paint.text, this._paint.shape * this._dpr);
        img.addEventListener('load', () => this._map && this._draw(), { once: true });
        this._icons.set(svg, img);
      }
      return img;
    },

    _draw(this: Internals) {
      const ctx = this._ctx;
      const b = this._bounds;
      const size = b.getSize();
      const m = this._dpr;
      const P = this._paint;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
      ctx.setTransform(m, 0, 0, m, -b.min.x * m, -b.min.y * m);
      const pts = this._pts;
      const maxX = b.min.x + size.x;
      const maxY = b.min.y + size.y;
      const pad = 40;
      ctx.lineJoin = 'round';
      for (let i = 0; i < this._specs.length; i++) {
        const x = pts[i * 2];
        const y = pts[i * 2 + 1];
        if (x < b.min.x - pad || x > maxX + pad || y < b.min.y - pad || y > maxY + pad) continue;
        drawGlyph(ctx, this._specs[i].glyph, x, y, this._specs[i].size, P, (svg) => this._icon(svg));
      }
    },
  });
}

/** 12 x 12 그림(markers.ts shapeSvg)을 shape px 크기로 */
function drawShape(ctx: CanvasRenderingContext2D, m: MapMethod, x: number, y: number, P: Paint) {
  const k = P.shape / 12;
  const cx = x;
  const cy = y;
  ctx.beginPath();
  if (m === '재활용') {
    ctx.arc(cx, cy, 5 * k, 0, Math.PI * 2);
    ctx.fillStyle = P.recycle;
    ctx.strokeStyle = P.page;
    ctx.lineWidth = 1.5 * k;
  } else if (m === '소각') {
    const s = 9.5 * k;
    const r = 1 * k;
    const l = cx - s / 2;
    const t = cy - s / 2;
    ctx.moveTo(l + r, t);
    ctx.arcTo(l + s, t, l + s, t + s, r);
    ctx.arcTo(l + s, t + s, l, t + s, r);
    ctx.arcTo(l, t + s, l, t, r);
    ctx.arcTo(l, t, l + s, t, r);
    ctx.closePath();
    ctx.fillStyle = P.burn;
    ctx.strokeStyle = P.page;
    ctx.lineWidth = 1.5 * k;
  } else if (m === '매립') {
    ctx.moveTo(cx, cy - 5.2 * k);
    ctx.lineTo(cx + 5.4 * k, cy + 4.8 * k);
    ctx.lineTo(cx - 5.4 * k, cy + 4.8 * k);
    ctx.closePath();
    ctx.fillStyle = P.landfill;
    ctx.strokeStyle = P.page;
    ctx.lineWidth = 1.5 * k;
  } else {
    ctx.arc(cx, cy, 4.25 * k, 0, Math.PI * 2);
    ctx.fillStyle = P.page;
    ctx.strokeStyle = P.landfill;
    ctx.lineWidth = 2 * k;
  }
  ctx.fill();
  ctx.stroke();
}

let bubblePath: Path2D | null = null;

function drawGlyph(
  ctx: CanvasRenderingContext2D,
  g: Glyph,
  x: number,
  y: number,
  size: number,
  P: Paint,
  icon: (svg: string) => HTMLImageElement,
) {
  if (g.kind === 'dot') {
    drawShape(ctx, g.method, x, y, P);
    return;
  }
  if (g.kind === 'cluster') {
    const r = size / 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = P.page;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r - P.ring, 0, Math.PI * 2);
    ctx.fillStyle = P.brand;
    ctx.fill();
    ctx.fillStyle = P.inverse;
    ctx.font = `${P.fontWeight} ${g.tier === 'l' ? P.fontL : P.fontS}px ${P.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(g.n), x, y + 0.5);
    return;
  }
  // 처리업체: 아래 가운데가 기준점인 말풍선, 그 안 40% 높이에 처리 방식 아이콘
  bubblePath ??= new Path2D(BUBBLE_PATH);
  const left = x - size / 2;
  const top = y - size;
  const k = size / 32;
  ctx.save();
  ctx.translate(left, top);
  ctx.scale(k, k);
  ctx.fillStyle = P.page;
  ctx.strokeStyle = P.strong;
  ctx.lineWidth = 1.5;
  ctx.fill(bubblePath);
  ctx.stroke(bubblePath);
  ctx.restore();
  if (!g.iconSvg) return;
  const img = icon(g.iconSvg);
  if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, x - P.shape / 2, top + size * 0.4 - P.shape / 2, P.shape, P.shape);
}
