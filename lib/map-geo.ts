// 지도 계산(순수 함수). 좌표는 API와 같은 [lng, lat]. 화면 그리기와 무관해서 node:test로 확인한다.

export type LngLat = [number, number];
/** [남서, 북동] 모서리. 둘 다 [lng, lat] */
export type Bounds = [LngLat, LngLat];

export function boundsOf(points: LngLat[]): Bounds | null {
  if (!points.length) return null;
  let w = Infinity,
    s = Infinity,
    e = -Infinity,
    n = -Infinity;
  for (const [lng, lat] of points) {
    if (lng < w) w = lng;
    if (lng > e) e = lng;
    if (lat < s) s = lat;
    if (lat > n) n = lat;
  }
  return [
    [w, s],
    [e, n],
  ];
}

export const inBounds = ([lng, lat]: LngLat, [[w, s], [e, n]]: Bounds) => lng >= w && lng <= e && lat >= s && lat <= n;

/**
 * 첫 화면 범위: 점이 가장 많이 이어진 덩어리(반월시화 산단)의 범위.
 * 경위도 격자(기본 0.01도, 약 1km)에 점을 넣고, 점이 있는 칸끼리 8방향으로 이어진 덩어리 중
 * 점이 가장 많은 것을 고른다. 섬(대부도)처럼 떨어진 점은 다른 덩어리라 빠지고 "지도 범위 밖"으로 센다.
 */
export function mainClusterBounds(points: LngLat[], cellDeg = 0.01): { bounds: Bounds | null; inside: boolean[] } {
  const key = ([lng, lat]: LngLat) => `${Math.floor(lng / cellDeg)},${Math.floor(lat / cellDeg)}`;
  const cells = new Map<string, number[]>();
  points.forEach((p, i) => {
    const k = key(p);
    const list = cells.get(k);
    if (list) list.push(i);
    else cells.set(k, [i]);
  });

  const seen = new Set<string>();
  let best: number[] = [];
  for (const start of cells.keys()) {
    if (seen.has(start)) continue;
    const members: number[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const k = stack.pop()!;
      members.push(...cells.get(k)!);
      const [cx, cy] = k.split(',').map(Number);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const nk = `${cx + dx},${cy + dy}`;
          if (cells.has(nk) && !seen.has(nk)) {
            seen.add(nk);
            stack.push(nk);
          }
        }
      }
    }
    if (members.length > best.length) best = members;
  }

  const inside = points.map(() => false);
  for (const i of best) inside[i] = true;
  return { bounds: boundsOf(best.map((i) => points[i])), inside };
}

export type Pixel = { x: number; y: number };

export type Cluster<T> = {
  /** 이 확대 단계에서 칸 위치로 만든 id */
  id: string;
  at: LngLat;
  items: T[];
  /** 모든 점이 같은 좌표(같은 건물)라 확대해도 풀리지 않음 */
  samePlace: boolean;
};

/**
 * 화면 좌표 격자 묶음. project는 지도의 현재 확대 단계 픽셀 좌표(세계 기준)를 돌려준다.
 * 한 칸(cellPx) 안의 점은 하나로 묶고, 위치는 점들의 평균. 점 하나인 칸은 그대로 점이다.
 */
export function gridCluster<T>(items: T[], at: (item: T) => LngLat, project: (p: LngLat) => Pixel, cellPx: number): Cluster<T>[] {
  const cells = new Map<string, T[]>();
  for (const item of items) {
    const { x, y } = project(at(item));
    const k = `${Math.floor(x / cellPx)}:${Math.floor(y / cellPx)}`;
    const list = cells.get(k);
    if (list) list.push(item);
    else cells.set(k, [item]);
  }
  const out: Cluster<T>[] = [];
  for (const [k, list] of cells) {
    let lng = 0,
      lat = 0;
    const [f0, f1] = at(list[0]);
    let same = true;
    for (const item of list) {
      const [a, b] = at(item);
      lng += a;
      lat += b;
      if (a !== f0 || b !== f1) same = false;
    }
    out.push({
      id: k,
      at: [lng / list.length, lat / list.length],
      items: list,
      samePlace: same,
    });
  }
  return out;
}

/** 묶음 크기 단계(Figma Map/Cluster S, M, L) */
export const clusterSize = (n: number): 's' | 'm' | 'l' => (n < 10 ? 's' : n < 100 ? 'm' : 'l');
