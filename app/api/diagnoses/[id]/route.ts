import { buildResult, loadDiagnosis } from '@/lib/diagnosis';
import { body, db, dbFail, fail, isOwner, isUuid, json } from '@/lib/server';
import { validateDiagnosisPatch } from '@/lib/validate';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isUuid(id)) return fail(404, 'not found');
  const diag = await loadDiagnosis(id).catch(() => null);
  if (!diag) return fail(404, 'not found');
  if (!(await isOwner(req, diag))) return fail(403, 'forbidden');
  if (diag.status !== 'draft') return fail(409, '완료된 진단은 수정할 수 없음');

  const b = await body(req);
  if (!b) return fail(400, 'JSON body 필요');
  const [patch, err] = validateDiagnosisPatch(b);
  if (err) return fail(400, err);
  if (!Object.keys(patch).length) return fail(400, '바꿀 값 없음');

  const { data, error } = await db().from('diagnoses').update(patch).eq('id', id).eq('status', 'draft')
    .select('id,chip_id,waste_group,factory_id,volume_option_id,weight_kg_per_month,weight_source,current_cost_won_per_month,current_price_won_per_ton,current_method,lat,lng,location_source,status')
    .maybeSingle();
  // 없는 factory_id, volume_option_id는 FK 위반(23503)
  if (error) return error.code === '23503' ? fail(400, '없는 factory_id 또는 volume_option_id') : dbFail(error);
  // 확인과 수정 사이에 완료되면 draft 조건에 걸려 0행
  if (!data) return fail(409, '완료된 진단은 수정할 수 없음');
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
