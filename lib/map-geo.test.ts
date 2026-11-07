import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boundsOf, clusterSize, gridCluster, inBounds, mainClusterBounds, type LngLat } from './map-geo.ts';

test('main cluster drops a detached island and keeps the dense area', () => {
  const dense: LngLat[] = [];
  for (let i = 0; i < 50; i++) dense.push([126.72 + i * 0.0018, 37.29 + (i % 10) * 0.003]);
  const island: LngLat[] = [
    [126.577, 37.25],
    [126.586, 37.243],
  ];
  const { bounds, inside } = mainClusterBounds([...dense, ...island]);
  assert.deepEqual(bounds, boundsOf(dense));
  assert.equal(inside.filter((x) => !x).length, 2);
  assert.equal(inBounds(island[0], bounds!), false);
  assert.equal(inBounds(dense[3], bounds!), true);
});

test('main cluster of no points has no bounds', () => {
  assert.equal(mainClusterBounds([]).bounds, null);
});

test('grid cluster groups points in one cell and keeps the rest as dots', () => {
  const pts = [
    { id: 'a', at: [0, 0] as LngLat },
    { id: 'b', at: [0, 0] as LngLat },
    { id: 'c', at: [5, 5] as LngLat },
    { id: 'd', at: [50, 50] as LngLat },
  ];
  const project = ([x, y]: LngLat) => ({ x, y });
  const out = gridCluster(pts, (p) => p.at, project, 10);
  assert.equal(out.length, 2);
  const big = out.find((c) => c.items.length === 3)!;
  assert.equal(big.samePlace, false);
  assert.deepEqual(big.at, [5 / 3, 5 / 3]);
  const same = gridCluster(pts.slice(0, 2), (p) => p.at, project, 10);
  assert.equal(same[0].samePlace, true);
  // 모든 점이 어딘가에 한 번씩
  assert.equal(
    out.reduce((n, c) => n + c.items.length, 0),
    pts.length,
  );
});

test('cluster size steps follow Figma S, M, L', () => {
  assert.equal(clusterSize(2), 's');
  assert.equal(clusterSize(10), 'm');
  assert.equal(clusterSize(100), 'l');
});
