import { body, db, dbFail, fail, isOperator, isUuid, json } from '@/lib/server';

const STATUSES = ['requested', 'contacted', 'sample', 'contracted', 'first_pickup', 'cancelled', 'rejected'];

// 운영자 상태 변경: Authorization: Bearer <Supabase 로그인 토큰>, profiles.role = 'operator'
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return fail(404, 'not found');
  if (!(await isOperator(req))) return fail(403, 'operator only');
  const b = await body(req);
  if (!b || typeof b.status !== 'string' || !STATUSES.includes(b.status)) return fail(400, `status는 ${STATUSES.join(', ')}`);
  if ('note' in b && (typeof b.note !== 'string' || b.note.length > 500)) return fail(400, 'note는 500자 이하 문자열');

  const { data, error } = await db().from('connection_requests').update({ status: b.status })
    .eq('id', id).select('id,processor_id,status,sla_due_at').maybeSingle();
  if (error) return dbFail(error);
  if (!data) return fail(404, 'not found');
  await db().from('request_events').insert({ request_id: id, status: b.status, note: b.note ?? null, actor: 'operator' });
  return json(data);
}
