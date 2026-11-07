import { loadDiagnosis } from '@/lib/diagnosis';
import { addBusinessDays } from '@/lib/fit';
import { body, db, dbFail, fail, isOwner, isUuid, json } from '@/lib/server';

const PHONE = /^0\d{1,2}-?\d{3,4}-?\d{4}$/;

// 연결 요청: { diagnosis_id, candidate_id, contact_name, contact_phone, join_group?, kakao_notify? }
export async function POST(req: Request) {
  const b = await body(req);
  if (!b || typeof b.diagnosis_id !== 'string' || !isUuid(b.diagnosis_id) || !Number.isInteger(b.candidate_id))
    return fail(400, 'diagnosis_id, candidate_id 필요');
  const name = typeof b.contact_name === 'string' ? b.contact_name.trim() : '';
  const phone = typeof b.contact_phone === 'string' ? b.contact_phone.trim() : '';
  if (!name || name.length > 50) return fail(400, 'contact_name 1~50자');
  if (!PHONE.test(phone)) return fail(400, 'contact_phone 형식 오류');
  for (const k of ['join_group', 'kakao_notify'])
    if (k in b && typeof b[k] !== 'boolean') return fail(400, `${k}는 true/false`);

  try {
    const diag = await loadDiagnosis(b.diagnosis_id);
    if (!diag) return fail(404, 'not found');
    if (!(await isOwner(req, diag))) return fail(403, 'forbidden');
    if (diag.status !== 'completed') return fail(409, '진단 완료 후 요청 가능');

    const { data: cand } = await db().from('diagnosis_candidates').select('id,processor_id')
      .eq('id', b.candidate_id).eq('diagnosis_id', diag.id).maybeSingle();
    if (!cand) return fail(400, '이 진단의 후보가 아님');
    const { count } = await db().from('connection_requests').select('id', { count: 'exact', head: true })
      .eq('candidate_id', cand.id).not('status', 'in', '(cancelled,rejected)');
    if (count) return fail(409, '이미 진행 중인 요청이 있음');

    const { data, error } = await db().from('connection_requests').insert({
      diagnosis_id: diag.id, candidate_id: cand.id, processor_id: cand.processor_id,
      user_id: diag.user_id, anon_token: diag.anon_token,
      contact_name: name, contact_phone: phone,
      join_group: b.join_group ?? true, kakao_notify: b.kakao_notify ?? true,
      sla_due_at: addBusinessDays(new Date(), 2).toISOString(),
    }).select('id,diagnosis_id,candidate_id,processor_id,status,join_group,kakao_notify,sla_due_at,created_at').single();
    // 동시 요청: 부분 유니크 인덱스 connection_requests_active_candidate_uniq 위반
    if (error) return error.code === '23505' ? fail(409, '이미 진행 중인 요청이 있음') : dbFail(error);
    await db().from('request_events').insert({ request_id: data.id, status: 'requested', actor: 'user' });
    return json({ ...data, labels: { sla: '영업일 2일 기준(공휴일 미반영)', processor: '실제 처리 가능 여부는 업체 확인 필요' } }, 201);
  } catch (e) {
    return dbFail(e as Error);
  }
}
