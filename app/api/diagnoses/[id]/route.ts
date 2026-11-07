import { buildResult, loadDiagnosis } from '@/lib/diagnosis';
import { body, db, dbFail, fail, isOwner, isUuid, json } from '@/lib/server';

type Ctx = { params: Promise<{ id: string }> };

const ONE_OF = {
  current_method: ['소각', '매립', '에너지회수', '모름'],
  weight_source: ['계량표', '올바로 인계서', '기타'],
  location_source: ['주소', '현재위치', '신고공장'],
} as const;
const num = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

// 단계별 저장. 서버 계산 열(status, waste_group 등)은 받지 않는다
function validate(b: Record<string, unknown>): [Record<string, unknown>, string | null] {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(b)) {
    if (k in ONE_OF) {
      if (v !== null && !(ONE_OF[k as keyof typeof ONE_OF] as readonly unknown[]).includes(v)) return [out, `${k} 값이 올바르지 않음`];
    } else if (k === 'weight_kg_per_month') {
      if (v !== null && !num(v, Number.MIN_VALUE, 1e7)) return [out, 'weight_kg_per_month는 0보다 큰 kg'];
    } else if (k === 'current_cost_won_per_month') {
      if (v !== null && !(Number.isInteger(v) && num(v, 0, 1e11))) return [out, 'current_cost_won_per_month는 0 이상 정수(원)'];
    } else if (k === 'lat' || k === 'lng') {
      if (v !== null && !num(v, k === 'lat' ? -90 : -180, k === 'lat' ? 90 : 180)) return [out, `${k} 범위 오류`];
    } else if (k === 'factory_id' || k === 'volume_option_id') {
      if (v !== null && typeof v !== 'string') return [out, `${k}는 문자열`];
    } else return [out, `수정할 수 없는 열: ${k}`];
    out[k] = v;
  }
  if (('lat' in out) !== ('lng' in out) || (out.lat === null) !== (out.lng === null)) return [out, 'lat, lng는 함께'];
  return [out, null];
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isUuid(id)) return fail(404, 'not found');
  const diag = await loadDiagnosis(id).catch(() => null);
  if (!diag) return fail(404, 'not found');
  if (!(await isOwner(req, diag))) return fail(403, 'forbidden');
  if (diag.status !== 'draft') return fail(409, '완료된 진단은 수정할 수 없음');

  const b = await body(req);
  if (!b) return fail(400, 'JSON body 필요');
  const [patch, err] = validate(b);
  if (err) return fail(400, err);
  if (!Object.keys(patch).length) return fail(400, '바꿀 값 없음');

  const { data, error } = await db().from('diagnoses').update(patch).eq('id', id).eq('status', 'draft')
    .select('id,chip_id,waste_group,factory_id,volume_option_id,weight_kg_per_month,weight_source,current_cost_won_per_month,current_method,lat,lng,location_source,status')
    .single();
  // 없는 factory_id, volume_option_id는 FK 위반(23503)
  if (error) return error.code === '23503' ? fail(400, '없는 factory_id 또는 volume_option_id') : dbFail(error);
  return json(data);
}

// 결과 조회. 본인이면 전체, 아니면 공유 링크용(공장, 위치, 처리비 제외)
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isUuid(id)) return fail(404, 'not found');
  try {
    const diag = await loadDiagnosis(id);
    if (!diag || diag.status !== 'completed') return fail(404, 'not found');
    return json(await buildResult(diag, await isOwner(req, diag)));
  } catch (e) {
    return dbFail(e as Error);
  }
}
