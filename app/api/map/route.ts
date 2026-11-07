import { factoryMethods } from '@/lib/map';
import { cached, db, dbFail, fail, fetchAll } from '@/lib/server';

type P = { id: string; name: string; lat: number | null; lng: number | null; coord_verified: boolean | null; [k: string]: unknown };
const point = ({ lat, lng, ...props }: P) =>
  ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: props });
const fc = (features: unknown[]) => ({ type: 'FeatureCollection', features });

const LABELS = {
  coords: '건물 위치로 확인된 좌표만 표시. 좌표 없는 곳은 지도에 그리지 않음',
  method: '공장별로 신고가 가장 많은 처리 방식(물질재활용=재활용, 소각과 에너지회수=소각, 매립, 나머지=미확인). 동률이면 재활용, 소각, 매립 순. group이 없으면 모든 폐기물군',
  flows: '신고 건수 기준(톤수 아님). weight 합 = 신고 행 수',
};

const factories = (group: string | null) => fetchAll<P>((a, b, opts) => {
  let q = db().from('factories').select('id,name,dong,waste_groups,lat,lng,coord_verified', opts).eq('coord_verified', true);
  if (group) q = q.contains('waste_groups', JSON.stringify([group]));  // jsonb는 JSON 문자열로
  return q.order('id').range(a, b);
});
const processors = () => fetchAll<P>((a, b, opts) => db().from('processors')
  .select('id,name,sido,sigungu,method,confirmed,lat,lng,coord_verified', opts).order('id').range(a, b));
type F = { factory_id: string | null; processor_id: string | null; method: string | null; weight: number };
const flows = (group: string | null) => fetchAll<F>((a, b, opts) => {
  let q = db().from('flows').select('factory_id,processor_id,method,weight', opts);
  if (group) q = q.eq('waste_group', group);
  return q.order('link_id').range(a, b);
});

// GET /api/map?layer=factories|processors|flows&group=폐기물군
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const layer = sp.get('layer') ?? 'factories';
  const group = sp.get('group') || null;
  try {
    if (layer === 'factories') {
      const [rows, fs] = await Promise.all([factories(group), flows(group)]);
      const method = factoryMethods(fs);
      return cached({ ...fc(rows.map(r => point({ ...r, method: method.get(r.id) ?? '미확인' }))), labels: LABELS });
    }

    if (layer === 'processors') {
      let rows = await processors();
      if (group) {
        const used = new Set((await flows(group)).map(f => f.processor_id));
        rows = rows.filter(p => used.has(p.id));
      }
      // 좌표 없는 처리업체는 시군구 목록으로
      const bySigungu = new Map<string, { sido: unknown; sigungu: unknown; processors: unknown[] }>();
      for (const p of rows.filter(p => !p.coord_verified)) {
        const key = `${p.sido ?? '소재지 미확인'}|${p.sigungu ?? ''}`;
        const g = bySigungu.get(key) ?? { sido: p.sido ?? '소재지 미확인', sigungu: p.sigungu ?? null, processors: [] };
        g.processors.push(p);
        bySigungu.set(key, g);
      }
      return cached({
        ...fc(rows.filter(p => p.coord_verified).map(point)),
        unlocated: [...bySigungu.values()].map(g => ({ ...g, count: g.processors.length }))
          .sort((a, b) => b.count - a.count),
        labels: LABELS,
      });
    }

    if (layer === 'flows') {
      const [fs, fa, pr] = await Promise.all([flows(group), factories(null), processors()]);
      const F = new Map(fa.map(f => [f.id, f]));
      const Pm = new Map(pr.filter(p => p.coord_verified).map(p => [p.id, p]));
      const lines = new Map<string, { f: P; p: P; method: string | null; weight: number }>();
      let total = 0, located = 0;
      for (const x of fs) {
        total += x.weight;
        const f = F.get(x.factory_id ?? ''), p = Pm.get(x.processor_id ?? '');
        if (!f || !p) continue;
        located += x.weight;
        const k = `${f.id}|${p.id}|${x.method}`;
        const l = lines.get(k) ?? { f, p, method: x.method, weight: 0 };
        l.weight += x.weight;
        lines.set(k, l);
      }
      const r1 = (n: number) => Math.round(n * 10) / 10;
      return cached({
        ...fc([...lines.values()].map(l => ({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [[l.f.lng, l.f.lat], [l.p.lng, l.p.lat]] },
          properties: { factory_id: l.f.id, processor_id: l.p.id, method: l.method, reports: r1(l.weight) },
        }))),
        coverage: { total_reports: r1(total), drawn_reports: r1(located), drawn_pct: total ? r1((100 * located) / total) : 0 },
        labels: { ...LABELS, coverage: '공장과 처리업체 좌표가 모두 확인된 신고만 선으로 그림' },
      });
    }
    return fail(400, 'layer는 factories, processors, flows');
  } catch (e) {
    return dbFail(e as Error);
  }
}
