import { buildResult, computeCandidates, diagnosisFlows, loadDiagnosis, referencePrices } from '@/lib/diagnosis';
import { neighborCounts, resolveCurrentMethod } from '@/lib/fit';
import { DATA_VERSION, db, dbFail, fail, isOwner, isUuid, json } from '@/lib/server';

// 진단 완료: 신고 경로 분포, 이웃 공장 수, 추천 3곳, 원문 단가를 모아 저장하고 반환. 금액은 만들지 않는다
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return fail(404, 'not found');
  try {
    const diag = await loadDiagnosis(id);
    if (!diag) return fail(404, 'not found');
    if (!(await isOwner(req, diag))) return fail(403, 'forbidden');
    if (diag.status === 'completed') return fail(409, '이미 완료됨. GET /api/diagnoses/:id 로 조회');
    if (!diag.waste_group) return fail(422, '품목(chip_id)이 없음');
    if (diag.weight_kg_per_month == null) return fail(422, 'weight_kg_per_month 필요');
    if (!diag.current_method) return fail(422, 'current_method 필요');

    const flows = await diagnosisFlows(diag);
    const method = resolveCurrentMethod(diag.current_method, flows.chip).method;
    const [ranked, prices] = await Promise.all([computeCandidates(diag, flows.group, method), referencePrices(diag.waste_group)]);
    const n = neighborCounts(flows.chip);   // 칩 원 표기 기준, 본인 공장 포함(홈 칩 통계와 같은 기준)

    // 다시 시도해도 같은 결과가 되도록 upsert(중간 실패 대비)
    if (ranked.length) {
      const c = await db().from('diagnosis_candidates').upsert(
        ranked.map(r => ({ diagnosis_id: id, ...r })), { onConflict: 'diagnosis_id,rank' });
      if (c.error) return dbFail(c.error);
    }
    const r = await db().from('diagnosis_results').upsert({
      diagnosis_id: id, neighbors_recycling: n.recycling, neighbors_burning: n.burning,
      reference_price_ids: prices.map(p => p.id), data_version: DATA_VERSION,
    });
    if (r.error) return dbFail(r.error);
    const { data: done, error } = await db().from('diagnoses')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id).eq('status', 'draft').select('*').single();
    if (error) return dbFail(error);

    return json(await buildResult(done, true, flows));
  } catch (e) {
    return dbFail(e as Error);
  }
}
