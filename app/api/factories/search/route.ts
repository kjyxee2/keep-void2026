import { db, dbFail, fail, json } from '@/lib/server';

// 진단 3단계 "우리 공장 찾기": 공개 신고현황의 사업장명, 주소 검색
export async function GET(req: Request) {
  // PostgREST or() 문법 문자(쉼표, 괄호 등)와 와일드카드는 지워서 필터 조작을 막는다
  const q = (new URL(req.url).searchParams.get('q') ?? '').replace(/[,()*%_\\"'.:]/g, ' ').trim().slice(0, 50);
  if (q.length < 2) return fail(400, 'q는 2자 이상');
  const { data, error } = await db().from('factories')
    .select('id,name,address,dong,waste_groups,coord_verified')
    .or(`name.ilike.%${q}%,address.ilike.%${q}%`)
    .order('name').limit(10);
  if (error) return dbFail(error);
  return json({ factories: data });
}
