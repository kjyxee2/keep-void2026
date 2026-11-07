import { FACTORY_PUBLIC_COLUMNS, isFactoryIdParam, publicFactory } from '@/lib/factory';
import { cached, db, dbFail, fail } from '@/lib/server';

// 신고 공장 한 곳(공개 열만). 진단 ?factory= 로 넘어온 사업장을 3단계에 미리 채울 때 쓴다
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isFactoryIdParam(id)) return fail(404, 'not found');
  const { data, error } = await db().from('factories').select(FACTORY_PUBLIC_COLUMNS).eq('id', id).maybeSingle();
  if (error) return dbFail(error);
  if (!data) return fail(404, 'not found');
  return cached(publicFactory(data as Record<string, unknown>));
}
