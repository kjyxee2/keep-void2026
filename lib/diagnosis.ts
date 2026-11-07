// 진단 결과 조립(complete, GET 공용). 금액 계산 없음.
import { db, fetchAll, LABELS } from './server';
import {
  BURN_METHODS, EXCLUDED_GROUPS, pickStored, rankComputed, resolveCurrentMethod, routeShare,
  type Flow, type Proc, type Ranked,
} from './fit';

export type Diagnosis = {
  id: string; user_id: string | null; anon_token: string | null; factory_id: string | null;
  chip_id: string | null; waste_group: string | null; volume_option_id: string | null;
  weight_kg_per_month: number | null; weight_source: string | null; current_cost_won_per_month: number | null;
  current_method: string | null; lat: number | null; lng: number | null; location_source: string | null;
  status: 'draft' | 'completed'; created_at: string; completed_at: string | null;
};

export async function loadDiagnosis(id: string) {
  const { data, error } = await db().from('diagnoses').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Diagnosis | null;
}

export function groupFlows(group: string) {
  return fetchAll<Flow>((from, to) => db().from('flows')
    .select('factory_id,processor_id,method,method_by_other_group_permit,region,weight')
    .eq('waste_group', group).order('link_id').range(from, to));
}

export async function referencePrices(group: string) {
  const { data, error } = await db().from('unit_prices').select('*').eq('waste_group', group).order('id');
  if (error) throw error;
  return data ?? [];
}

async function origin(diag: Diagnosis) {
  if (diag.lat != null && diag.lng != null) return { lat: diag.lat, lng: diag.lng };
  if (!diag.factory_id) return null;
  const { data } = await db().from('factories').select('lat,lng,coord_verified').eq('id', diag.factory_id).maybeSingle();
  return data?.coord_verified ? { lat: data.lat, lng: data.lng } : null;
}

export async function computeCandidates(diag: Diagnosis, flows: Flow[]): Promise<Ranked[]> {
  const group = diag.waste_group!;
  if (EXCLUDED_GROUPS.includes(group)) return [];

  let stored: Array<Omit<Ranked, 'rank' | 'source'>> = [];
  if (diag.factory_id) {
    const { data, error } = await db().from('fit_candidates')
      .select('processor_id:candidate_processor_id,fit_score,evidence_rows,distance_km,distance_quality,candidate_confirmed')
      .eq('factory_id', diag.factory_id).eq('waste_group', group);
    if (error) throw error;
    stored = data ?? [];
  }
  const ids = [...new Set([...stored.map(r => r.processor_id),
    ...flows.filter(f => f.method === '물질재활용' && f.processor_id).map(f => f.processor_id!)])];
  const { data: procRows, error } = ids.length
    ? await db().from('processors').select('id,method,confirmed,lat,lng,coord_verified').in('id', ids)
    : { data: [], error: null };
  if (error) throw error;
  const procs = new Map((procRows as Proc[]).map(p => [p.id, p]));

  const picked = pickStored(stored, procs);
  if (picked.length) return picked;
  return rankComputed({
    flows, procs, origin: await origin(diag), selfFactoryId: diag.factory_id,
    currentMethod: resolveCurrentMethod(diag.current_method ?? '모름', flows).method,
  });
}

async function candidateCards(diagnosisId: string) {
  const { data, error } = await db().from('diagnosis_candidates')
    .select('id,rank,processor_id,fit_score,evidence_rows,distance_km,distance_quality,candidate_confirmed,source,processors(name,sigungu,confirm_status)')
    .eq('diagnosis_id', diagnosisId).order('rank');
  if (error) throw error;
  return (data ?? []).map(({ id, processors: p, evidence_rows, candidate_confirmed, ...c }) => {
    const proc = (Array.isArray(p) ? p[0] : p) as { name: string; sigungu: string | null; confirm_status: string | null } | null;
    return {
      candidate_id: id, ...c, name: proc?.name ?? null, sigungu: proc?.sigungu ?? null,
      neighbors: evidence_rows, confirmed: candidate_confirmed, confirm_status: proc?.confirm_status ?? null,
      note: '업체 확인 필요',
    };
  });
}

// full=false: 공유 링크용. 공장, 위치, 처리비, 연락처는 넣지 않는다
export async function buildResult(diag: Diagnosis, full: boolean, flows?: Flow[]) {
  const group = diag.waste_group!;
  flows ??= await groupFlows(group);
  const [{ data: result }, cards, prices, { data: chip }, { data: volume }] = await Promise.all([
    db().from('diagnosis_results').select('*').eq('diagnosis_id', diag.id).maybeSingle(),
    candidateCards(diag.id),
    referencePrices(group),
    db().from('waste_chips').select('id,label,display_text').eq('id', diag.chip_id ?? '').maybeSingle(),
    db().from('volume_options').select('id,label').eq('id', diag.volume_option_id ?? '').maybeSingle(),
  ]);
  const method = resolveCurrentMethod(diag.current_method ?? '모름', flows);

  return {
    diagnosis_id: diag.id,
    status: diag.status,
    completed_at: diag.completed_at,
    data_version: result?.data_version ?? null,
    waste_group: group,
    user_input: {
      chip, volume_option: volume,
      weight_kg_per_month: diag.weight_kg_per_month, weight_source: diag.weight_source,
      current_method: diag.current_method,
      ...(full && {
        current_cost_won_per_month: diag.current_cost_won_per_month,
        factory_id: diag.factory_id, lat: diag.lat, lng: diag.lng, location_source: diag.location_source,
      }),
    },
    current_route: { ...routeShare(flows), basis: LABELS.route },
    neighbors: {
      recycling: result?.neighbors_recycling ?? null, burning: result?.neighbors_burning ?? null,
      burning_methods: BURN_METHODS, basis: LABELS.neighbors,
    },
    candidates: cards,
    ranking: { current_method_used: method.method, inferred_from_reports: method.inferred, rule: 'data/demo/README.md fit_score' },
    reference_prices: prices,
    labels: LABELS,
  };
}
