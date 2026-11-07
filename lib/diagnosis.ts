// 진단 결과 조립(complete, GET 공용). 금액 계산 없음.
import { db, fetchAll, LABELS } from './server';
import {
  BURN_METHODS, EXCLUDED_GROUPS, candidateReasons, chipFlows, splitTransporters, pickAnsan, pickStored, rankComputed, splitAnsan, priceYearLabel, referencePriceIds, resolveCurrentMethod, routeShare,
  type Flow, type Proc, type Ranked, type Reason,
} from './fit';

export type Diagnosis = {
  id: string; user_id: string | null; anon_token: string | null; factory_id: string | null;
  chip_id: string | null; waste_group: string | null; volume_option_id: string | null;
  weight_kg_per_month: number | null; weight_source: string | null; current_cost_won_per_month: number | null;
  current_price_won_per_ton: number | null;
  current_processor_id?: string | null; current_processor_name_raw?: string | null;
  current_method: string | null; lat: number | null; lng: number | null; location_source: string | null;
  status: 'draft' | 'completed'; created_at: string; completed_at: string | null;
};

export async function loadDiagnosis(id: string) {
  const { data, error } = await db().from('diagnoses').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Diagnosis | null;
}

export function groupFlows(group: string) {
  return fetchAll<Flow>((from, to, opts) => db().from('flows')
    .select('factory_id,processor_id,method,method_by_other_group_permit,region,waste_type,transporter,weight', opts)
    .eq('waste_group', group).order('link_id').range(from, to));
}

// 진단의 신고 경로 두 가지: group(폐기물군 전체, 추천 순위 규칙용)과 chip(칩 원 표기, 경로 분포와 이웃 수)
export type DiagFlows = { group: Flow[]; chip: Flow[] };
export async function diagnosisFlows(diag: Diagnosis): Promise<DiagFlows> {
  const [group, { data: chip, error }] = await Promise.all([
    groupFlows(diag.waste_group!),
    db().from('waste_chips').select('waste_types').eq('id', diag.chip_id ?? '').maybeSingle(),
  ]);
  if (error) throw error;
  return { group, chip: chipFlows(group, chip?.waste_types as string[] | null) };
}

// 공개 단가 원문 행(규칙은 lib/fit.ts referencePriceIds). unit_prices는 177행이라 한 번에 받아 고른다
export async function referencePrices(diag: Pick<Diagnosis, 'chip_id' | 'waste_group'>) {
  const { data, error } = await db().from('unit_prices').select('*').order('id');
  if (error) throw error;
  const rows = data ?? [];
  const ids = new Set(referencePriceIds({ id: diag.chip_id ?? '', waste_group: diag.waste_group }, rows));
  return rows.filter(r => ids.has(r.id)).map(r => ({ ...r, year_label: priceYearLabel(r) }));
}

async function origin(diag: Diagnosis) {
  if (diag.lat != null && diag.lng != null) return { lat: diag.lat, lng: diag.lng };
  if (!diag.factory_id) return null;
  const { data } = await db().from('factories').select('lat,lng,coord_verified').eq('id', diag.factory_id).maybeSingle();
  return data?.coord_verified ? { lat: data.lat, lng: data.lng } : null;
}

// 추천은 README fit_score 규칙대로 폐기물군 신고 경로(fit_candidates와 같은 기준)로 계산.
// ansan: 추천 3곳에 안산 업체가 없을 때만 같은 자격의 안산 업체 1곳(rank 0으로 저장). 순위는 바꾸지 않는다
export async function computeCandidates(diag: Diagnosis, flows: Flow[], currentMethod: string): Promise<{ top: Ranked[]; ansan: Ranked | null }> {
  const group = diag.waste_group!;
  if (EXCLUDED_GROUPS.includes(group)) return { top: [], ansan: null };

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
    ? await db().from('processors').select('id,method,confirmed,lat,lng,coord_verified,sigungu').in('id', ids)
    : { data: [], error: null };
  if (error) throw error;
  const procs = new Map((procRows as Proc[]).map(p => [p.id, p]));

  const opts = { flows, procs, origin: await origin(diag), selfFactoryId: diag.factory_id, currentMethod };
  const picked = pickStored(stored, procs);
  const top = picked.length ? picked : rankComputed(opts);
  const pool = [...pickStored(stored, procs, Infinity), ...rankComputed({ ...opts, limit: Infinity })];
  const used = new Set(flows.filter(f => diag.factory_id && f.factory_id === diag.factory_id).map(f => f.processor_id));
  return { top, ansan: pickAnsan(top, pool, procs, used) };
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

// 후보별 추천 이유(lib/fit.ts candidateReasons). 순위는 그대로. 쿼리는 후보 업체 id로 묶어 최대 3번(N+1 없음).
// 공유 보기(full=false)와 공장 없는 진단은 공장 정보(동, 운반업체)를 쓰지 않아 이웃 수와 안산 여부만
async function reasonsFor(
  diag: Diagnosis, full: boolean, groupFlows: Flow[],
  cards: Array<{ processor_id: string; neighbors: number; sigungu: string | null }>,
): Promise<Reason[][]> {
  const empty = { flows: groupFlows, self: null, factoryDong: new Map<string, string | null>(), transportRows: [] };
  if (!cards.length || !full || !diag.factory_id) return candidateReasons(cards, empty);
  const factoryId = diag.factory_id;
  const mine = new Set(groupFlows.filter(f => f.factory_id === factoryId).flatMap(f => splitTransporters(f.transporter)));
  const ids = cards.map(c => c.processor_id);
  const [{ data: me, error }, transportRows] = await Promise.all([
    db().from('factories').select('dong').eq('id', factoryId).maybeSingle(),
    mine.size
      ? fetchAll<{ processor_id: string; transporter: string | null }>((from, to, opts) => db().from('flows')
        .select('processor_id,transporter', opts).in('processor_id', ids).not('transporter', 'is', null)
        .order('link_id').range(from, to))
      : Promise.resolve([]),
  ]);
  if (error) throw error;
  const dong = (me?.dong as string | null) ?? null;
  const neighbors = dong
    ? await fetchAll<{ id: string; dong: string | null }>((from, to, opts) => db().from('factories')
      .select('id,dong', opts).eq('dong', dong).order('id').range(from, to))
    : [];
  return candidateReasons(cards, {
    flows: groupFlows, self: { factory_id: factoryId, dong }, transportRows,
    factoryDong: new Map(neighbors.map(f => [f.id, f.dong])),
  });
}

// 본인 보기 전용: 고른 신고 공장(공개 열 id, name, dong)과 지금 맡기는 처리업체(processors의 이름, 시군, 처리 방식)
async function ownerContext(diag: Diagnosis) {
  const [{ data: factory, error: fErr }, { data: processor, error: pErr }] = await Promise.all([
    diag.factory_id
      ? db().from('factories').select('id,name,dong').eq('id', diag.factory_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    diag.current_processor_id
      ? db().from('processors').select('id,name,sido,sigungu,method').eq('id', diag.current_processor_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (fErr || pErr) throw fErr ?? pErr;
  return {
    factory: factory as { id: string; name: string; dong: string | null } | null,
    processor: processor as { id: string; name: string; sido: string | null; sigungu: string | null; method: string | null } | null,
  };
}

// full=false: 공유 링크용. 공장, 위치, 처리비, 톤당 단가, 연락처는 넣지 않는다
export async function buildResult(diag: Diagnosis, full: boolean, flows?: DiagFlows) {
  const group = diag.waste_group!;
  flows ??= await diagnosisFlows(diag);
  const [{ data: result }, cards, prices, { data: chip }, { data: volume }, mine] = await Promise.all([
    db().from('diagnosis_results').select('*').eq('diagnosis_id', diag.id).maybeSingle(),
    candidateCards(diag.id),
    referencePrices(diag),
    db().from('waste_chips').select('id,label,display_text').eq('id', diag.chip_id ?? '').maybeSingle(),
    db().from('volume_options').select('id,label').eq('id', diag.volume_option_id ?? '').maybeSingle(),
    full ? ownerContext(diag) : Promise.resolve(null),
  ]);
  const method = resolveCurrentMethod(diag.current_method ?? '모름', flows.chip);
  const reasons = await reasonsFor(diag, full, flows.group, cards);
  const withReasons = cards.map((c, i) => ({ ...c, reasons: reasons[i] }));
  const { top, ansan } = splitAnsan(withReasons);

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
        current_price_won_per_ton: diag.current_price_won_per_ton,
        factory_id: diag.factory_id, lat: diag.lat, lng: diag.lng, location_source: diag.location_source,
        factory: mine?.factory ?? null,
        current_processor: mine?.processor ?? null,
        current_processor_name_raw: diag.current_processor_name_raw ?? null,
      }),
    },
    current_route: { ...routeShare(flows.chip), basis: LABELS.route },
    neighbors: {
      recycling: result?.neighbors_recycling ?? null, burning: result?.neighbors_burning ?? null,
      burning_methods: BURN_METHODS, basis: LABELS.neighbors,
    },
    candidates: top,
    ansan_candidate: ansan,
    ranking: { current_method_used: method.method, inferred_from_reports: method.inferred, rule: 'data/demo/README.md fit_score' },
    reference_prices: prices,
    labels: LABELS,
  };
}
