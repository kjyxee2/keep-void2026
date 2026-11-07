import { loadDiagnosis } from '@/lib/diagnosis';
import { findGroups, groupView, type GroupFactory, type GroupRow } from '@/lib/groups';
import { db, dbFail, fail, isOwner, isUuid, json } from '@/lib/server';

const ID = /^[A-Za-z0-9_-]{1,20}$/;
const LABELS = {
  groups: '같은 폐기물을 내는 가까운 공장 묶음(신고 공장 기준). 공장 이름은 넣지 않음',
  radius: 'radius_km = 묶음 중심에서 가장 먼 공장까지 직선거리',
  points: '좌표가 건물 위치로 확인된 공장만 점으로. [lng, lat]',
};

// GET /api/groups?factory_id=F0001[&group=폐합성수지류] | ?diagnosis_id=uuid (x-anon-token, 본인 진단만)
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const diagnosisId = sp.get('diagnosis_id');
  let factoryId = sp.get('factory_id');
  let group = sp.get('group') || null;
  if (group && group.length > 50) return fail(400, 'group은 50자 이하');

  try {
    if (diagnosisId) {
      // 진단의 공장을 드러내므로 본인만(공유 링크 응답은 factory_id를 빼므로 여기서도 막는다)
      if (!isUuid(diagnosisId)) return fail(404, 'not found');
      const diag = await loadDiagnosis(diagnosisId);
      if (!diag) return fail(404, 'not found');
      if (!(await isOwner(req, diag))) return fail(403, 'forbidden');
      if (!diag.factory_id) return json({ groups: [], labels: { ...LABELS, empty: '진단에 신고 공장이 없음(공장 찾기를 건너뜀)' } });
      factoryId = diag.factory_id;
      group = diag.waste_group;
    } else if (!factoryId || !ID.test(factoryId)) {
      return fail(400, 'factory_id 또는 diagnosis_id 필요');
    }

    const [{ data: factory, error: fErr }, { data: rows, error: gErr }] = await Promise.all([
      db().from('factories').select('id,dong,coord_verified,waste_groups').eq('id', factoryId).maybeSingle(),
      db().from('group_fit').select('group_id,waste_group,factory_ids,n,centroid_lat,centroid_lng,max_dist_km,dongs,n_distinct_processors'),
    ]);
    if (fErr || gErr) return dbFail(fErr ?? gErr);
    if (!factory) return fail(404, '없는 factory_id');

    const matches = findGroups(factory as GroupFactory, (rows ?? []) as GroupRow[], group);
    const ids = [...new Set(matches.flatMap(m => m.group.factory_ids))];
    const { data: pts, error: pErr } = ids.length
      ? await db().from('factories').select('id,lat,lng').in('id', ids).eq('coord_verified', true)
      : { data: [], error: null };
    if (pErr) return dbFail(pErr);
    const coords = new Map((pts ?? []).map(p => [p.id as string, { lat: p.lat as number, lng: p.lng as number }]));

    return json({
      groups: matches.map(m => groupView(m, coords, factory.id, factory.dong)),
      labels: LABELS,
    });
  } catch (e) {
    return dbFail(e as Error);
  }
}
