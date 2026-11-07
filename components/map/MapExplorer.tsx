// 이웃 공장 지도 화면의 데이터와 배치. 지도 본체(Leaflet)는 next/dynamic, ssr: false로 이 화면에서만 불러온다.
// 숫자는 전부 API 값: 공장 점 수 = GET /api/map?layer=factories&group= 의 features 수, 처리업체 = layer=processors,
// 위치 확인 비율 = layer=flows의 coverage.drawn_pct, 지역 비율 = GET /api/dashboard summary.region_pct.
'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WasteIcon } from '@/components/brand/Icon';
import { Button } from '@/components/ui/Button';
import { Footnote } from '@/components/ui/Footnote';
import { Option } from '@/components/ui/Option';
import { ErrorState } from '@/components/ui/States';
import { getDashboard, getMap } from '@/lib/api-client';
import { MAP_CHIPS, type MapChip } from '@/lib/map-chips';
import { inBounds, mainClusterBounds, type Bounds } from '@/lib/map-geo';
import type { MapFactoriesResponse, MapFlowsResponse, MapProcessorsResponse, UnlocatedGroup } from '@/lib/types';
import { MapLegend } from './MapLegend';
import type { FactoryFeature } from './markers';
import { RegionBars, type RegionRow } from './RegionBars';
import styles from './Map.module.css';

const OUTLINE_URL = '/brand/map/banwol_outline.svg';
const REGIONS = ['안산', '시흥', '경기 기타', '경기 밖', '미확인'];
const MapView = dynamic(() => import('./MapView').catch(() => ({ default: MapLoadFailed })), { ssr: false });

const num = (n: number) => n.toLocaleString('ko-KR', { maximumFractionDigits: 1 });

type ChipData = {
  factories: FactoryFeature[];
  coverage: MapFlowsResponse['coverage'] | null;
};
type Dashboard = {
  rows: RegionRow[];
  total: number | null;
  period: string | null;
};

function parseDashboard(summary: Record<string, unknown>): Dashboard {
  const s = summary as {
    region_pct?: Record<string, { value?: number }>;
    counts?: { flows?: { value?: number } };
    meta?: { period?: string };
  };
  const rows = REGIONS.flatMap((label) => {
    const v = s.region_pct?.[label]?.value;
    return typeof v === 'number' ? [{ label, pct: v }] : [];
  });
  return {
    rows,
    total: s.counts?.flows?.value ?? null,
    period: s.meta?.period ?? null,
  };
}

/** 지도 스크립트(Leaflet 묶음)를 못 받으면 정적 윤곽을 그대로 두고 실패 안내를 띄운다 */
function MapLoadFailed({ onTileFailure }: { onTileFailure: () => void }) {
  useEffect(() => onTileFailure(), [onTileFailure]);
  return null;
}

export function MapExplorer() {
  const [chip, setChip] = useState<MapChip>(MAP_CHIPS[0]);
  const [byChip, setByChip] = useState<Record<string, ChipData>>({});
  const [shownKey, setShownKey] = useState<string>(MAP_CHIPS[0].key);
  const [processors, setProcessors] = useState<MapProcessorsResponse | null>(null);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [tileFailed, setTileFailed] = useState(false);
  const inflight = useRef(new Map<string, Promise<ChipData>>());
  const latest = useRef(MAP_CHIPS[0].key);
  const onTileFailure = useCallback(() => setTileFailed(true), []);
  const onReady = useCallback(() => setMapReady(true), []);

  const load = useCallback((c: MapChip) => {
    const hit = inflight.current.get(c.key);
    if (hit) return hit;
    const g = c.group ?? undefined;
    const p = Promise.all([
      getMap('factories', g) as Promise<MapFactoriesResponse>,
      (getMap('flows', g) as Promise<MapFlowsResponse>).then((r) => r.coverage).catch(() => null),
    ]).then(([f, coverage]) => ({
      factories: f.features,
      coverage,
    }));
    inflight.current.set(c.key, p);
    p.catch(() => inflight.current.delete(c.key));
    return p;
  }, []);

  // 처음: 전체 공장(첫 화면 범위 계산), 처리업체, 지역 비율
  useEffect(() => {
    let alive = true;
    setError(null);
    load(MAP_CHIPS[0])
      .then((d) => alive && setByChip((m) => ({ ...m, [MAP_CHIPS[0].key]: d })))
      .catch(() => alive && setError('지도 자료를 불러오지 못했어요. 다시 시도해 주세요'));
    getMap('processors')
      .then((p) => alive && setProcessors(p as MapProcessorsResponse))
      .catch(() => alive && setError('지도 자료를 불러오지 못했어요. 다시 시도해 주세요'));
    getDashboard()
      .then((d) => alive && setDash(parseDashboard(d.summary)))
      .catch(() => alive && setDash({ rows: [], total: null, period: null }));
    return () => {
      alive = false;
    };
  }, [load, retry]);

  // 칩을 고르면 그 폐기물군을 받아서 보여 준다(받는 동안은 이전 점을 그대로 둔다)
  const choose = (c: MapChip) => {
    setChip(c);
    latest.current = c.key;
    load(c)
      .then((d) => {
        setByChip((m) => ({ ...m, [c.key]: d }));
        // 빠르게 여러 번 바꿨으면 마지막에 고른 칩만 보여 준다
        if (latest.current === c.key) setShownKey(c.key);
      })
      .catch(() => setError('지도 자료를 불러오지 못했어요. 다시 시도해 주세요'));
  };

  const all = byChip[MAP_CHIPS[0].key];
  const shown = byChip[shownKey];
  const shownChip = MAP_CHIPS.find((c) => c.key === shownKey)!;
  const loadingChip = chip.key !== shownKey;

  // 첫 화면 범위: 전체 공장 중 가장 큰 덩어리(반월시화 산단). 칩을 바꿔도 범위는 그대로
  const view = useMemo(() => {
    if (!all) return null;
    const { bounds, inside } = mainClusterBounds(all.factories.map((f) => f.geometry.coordinates));
    return {
      bounds: bounds as Bounds,
      inside: inside.filter(Boolean).length,
      total: all.factories.length,
    };
  }, [all]);

  const outside = useMemo(() => {
    if (!view || !shown) return { n: 0, dongs: [] as string[] };
    const out = shown.factories.filter((f) => !inBounds(f.geometry.coordinates, view.bounds));
    return {
      n: out.length,
      dongs: [...new Set(out.map((f) => f.properties.dong).filter((d): d is string => !!d))],
    };
  }, [view, shown]);

  const unlocated: UnlocatedGroup[] = processors?.unlocated ?? [];
  const unlocatedTotal = unlocated.reduce((n, g) => n + g.count, 0);
  const countLabel = shown
    ? `${shownChip.group ? `${shownChip.label} ` : ''}배출 공장 ${num(shown.factories.length)}곳`
    : '공장 위치를 불러오는 중이에요';

  return (
    <>
      <p className={styles.intro}>
        점 하나는 위치가 확인된 배출 공장 한 곳이에요.
        {/* 숫자가 오기 전에도 같은 문장 길이를 두어 아래 내용이 밀리지 않게 */} {view ? num(view.total) : '…'}곳 중 반월시화 일대{' '}
        {view ? num(view.inside) : '…'}곳이 지도 안에 있고, 종류를 고르면 그 폐기물을 내는 공장만 보여요.
      </p>

      <div className={styles.layout}>
        <div className={styles.main}>
          <div className={styles.frameWrap}>
            <a href="#map-waste" className={styles.skip}>
              지도 건너뛰기
            </a>
            <div className={styles.frame} data-factory-count={shown?.factories.length} data-chip={shownKey}>
              {/* 지도가 뜨기 전과 지도 스크립트를 못 받았을 때: 정적 윤곽 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={OUTLINE_URL} alt="" className={styles.placeholder} />
              {view && all && processors && (
                <MapView
                  bounds={view.bounds}
                  factories={(shown ?? all).factories}
                  dataKey={shown ? shownKey : MAP_CHIPS[0].key}
                  processors={processors.features}
                  onReady={onReady}
                  onTileFailure={onTileFailure}
                />
              )}
              <p className={styles.count} aria-live="polite">
                {countLabel}
              </p>
              {error && (
                <div className={styles.loadError}>
                  <ErrorState
                    message={error}
                    onRetry={() => {
                      inflight.current.clear();
                      setRetry((n) => n + 1);
                    }}
                  />
                </div>
              )}
              {!error && tileFailed && (
                <p className={`${styles.status} ${styles.statusError}`} role="status">
                  지도를 불러오지 못했어요. 바탕 윤곽만 보여 드려요.
                </p>
              )}
              {!error && !tileFailed && (loadingChip || (!mapReady && !!view)) && (
                <p className={styles.status} role="status">
                  불러오는 중이에요
                </p>
              )}
            </div>
          </div>

          <div className={styles.caption}>
            <p>
              점의 모양과 색은 그 공장의 {shownChip.group ? `${shownChip.label} ` : ''}신고 중 가장 많은 처리 방식이에요. 건수가 같으면
              재활용, 소각, 매립 순으로 골라요. 숫자 원은 가까운 공장 묶음이고 확대하면 풀려요.
            </p>
          </div>

          <div className={styles.legendBlock}>
            <MapLegend />
            <Footnote basis="공식 원값">공공데이터포털 15170508 배출신고 현황 좌표</Footnote>
          </div>

          <div className={styles.notice}>
            <p>
              위치가 확인된 처리업체 {processors ? `${num(processors.features.length)}곳` : ''}만 표시해요. 나머지는 시군 목록으로 보여
              드려요.
            </p>
            {outside.n > 0 && (
              <p className={styles.noticeSub}>
                지도 범위 밖 {num(outside.n)}곳{outside.dongs.length > 0 && ` (${outside.dongs.join(', ')} 공장)`}
              </p>
            )}
            {unlocated.length > 0 && (
              <details className={styles.unlocated}>
                <summary>위치를 모르는 처리업체 {num(unlocatedTotal)}곳 시군 목록</summary>
                <ul className={styles.unlocatedList}>
                  {unlocated.map((g) => (
                    <li key={`${g.sido}|${g.sigungu ?? ''}`}>
                      {g.sido}
                      {g.sigungu ? ` ${g.sigungu}` : ''} <span>{num(g.count)}곳</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>

        <aside className={styles.side} aria-label="지도 고르기와 요약">
          <fieldset className={styles.chips} id="map-waste" tabIndex={-1}>
            <legend className={styles.chipsLegend}>폐기물 종류</legend>
            <div className={styles.chipList}>
              {MAP_CHIPS.map((c) => (
                <Option
                  key={c.key}
                  name="map-waste"
                  value={c.key}
                  checked={chip.key === c.key}
                  onChange={() => choose(c)}
                  icon={c.icon ? <WasteIcon type={c.icon} size="sm" /> : undefined}
                  fullWidth
                >
                  {c.label}
                </Option>
              ))}
            </div>
          </fieldset>

          {/* 자료가 오기 전에도 같은 줄 수로 자리를 잡아 둔다(값은 …) */}
          <RegionBars
            rows={dash && dash.rows.length > 0 ? dash.rows : REGIONS.map((label) => ({ label, pct: null }))}
            total={dash?.total ?? null}
            period={dash?.period ?? null}
          />

          <div className={styles.info}>
            <p>
              점 모양과 색은 처리 방식이에요. 흑백으로 보아도 <strong>원, 사각, 삼각, 빈 원</strong>으로 구분돼요.
            </p>
            {shown?.coverage ? (
              <p>
                공장과 처리업체 위치가 모두 확인된 신고는 <strong>{num(shown.coverage.drawn_pct)}%</strong>예요(신고{' '}
                {num(shown.coverage.total_reports)}건 중 {num(shown.coverage.drawn_reports)}건).
              </p>
            ) : (
              <p>공장과 처리업체 위치가 모두 확인된 신고 비율을 불러오는 중이에요.</p>
            )}
            <p>흐름 비율은 신고 건수이며 톤수가 아니에요.</p>
          </div>

          <div className={styles.cta}>
            <Button href="/diagnose" size="mobile">
              우리 공장 보낼 곳 찾기
            </Button>
          </div>
        </aside>
      </div>
    </>
  );
}
