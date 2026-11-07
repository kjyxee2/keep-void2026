import { body, db, dbFail, fail, json, newAnonToken, userIdFrom } from '@/lib/server';

// 진단 시작: { chip_id } → { id, anon_token }. anon_token은 이때 한 번만 내려 준다(DB에는 해시)
export async function POST(req: Request) {
  const b = await body(req);
  if (typeof b?.chip_id !== 'string') return fail(400, 'chip_id 필요');
  const { data: chip, error: chipErr } = await db().from('waste_chips').select('id,waste_group').eq('id', b.chip_id).maybeSingle();
  if (chipErr) return dbFail(chipErr);
  if (!chip) return fail(400, '없는 chip_id');

  const { token, hash } = newAnonToken();
  const { data, error } = await db().from('diagnoses')
    .insert({ chip_id: chip.id, waste_group: chip.waste_group, anon_token: hash, user_id: await userIdFrom(req) })
    .select('id').single();
  if (error) return dbFail(error);
  return json({ id: data.id, anon_token: token }, 201);
}
