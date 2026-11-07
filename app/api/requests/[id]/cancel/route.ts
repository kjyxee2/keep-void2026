import { db, dbFail, fail, isOwner, isUuid, json } from '@/lib/server';

const CANCELLABLE = ['requested', 'contacted', 'sample'];

// 요청 취소(본인). 계약 이후 단계는 운영자에게 문의
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return fail(404, 'not found');
  const { data: r, error } = await db().from('connection_requests').select('id,status,anon_token,user_id').eq('id', id).maybeSingle();
  if (error) return dbFail(error);
  if (!r) return fail(404, 'not found');
  if (!(await isOwner(req, r))) return fail(403, 'forbidden');
  if (!CANCELLABLE.includes(r.status)) return fail(409, `${r.status} 상태는 취소할 수 없음`);

  const { data, error: e } = await db().from('connection_requests').update({ status: 'cancelled' })
    .eq('id', id).in('status', CANCELLABLE).select('id,status').single();
  if (e) return dbFail(e);
  await db().from('request_events').insert({ request_id: id, status: 'cancelled', actor: 'user' });
  return json(data);
}
