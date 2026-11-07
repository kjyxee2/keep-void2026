import { factorySearchFilter } from '@/lib/search';
import { db, dbFail, fail, json } from '@/lib/server';

// 진단 3단계, 홈 "우리 공장 찾기": 공개 신고현황의 사업장명, 주소 검색. (주), 괄호, 점이 든 이름도 그대로 찾는다
export async function GET(req: Request) {
  const filter = factorySearchFilter(new URL(req.url).searchParams.get('q') ?? '');
  if (!filter) return fail(400, 'q는 2자 이상');
  const { data, error } = await db().from('factories')
    .select('id,name,address,dong,waste_groups,n_waste_types,coord_verified')
    .or(filter)
    .order('name').limit(10);
  if (error) return dbFail(error);
  return json({ factories: data });
}
