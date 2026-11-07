// 진단 화면(app/diagnose/page.tsx, 서버 컴포넌트) 전용 읽기. 서비스 키를 쓰는 lib/server를 거치므로 클라이언트에서 import 금지.
// 공개 칩 목록과 ?factory= 로 넘어온 공장 한 곳만 읽는다(공개 신고현황 열만).
import { db } from './server';
import type { Chip } from './types';
import { isFactoryId, type PickedFactory } from './diagnose-state';

export async function loadChips(): Promise<Chip[] | null> {
  try {
    const { data, error } = await db().from('waste_chips').select('*').order('id');
    if (error || !data) return null;
    return data as Chip[];
  } catch {
    return null; // 화면이 브라우저에서 /api/chips로 다시 받는다
  }
}

export async function loadFactory(id: string | null | undefined): Promise<PickedFactory | null> {
  if (!isFactoryId(id)) return null;
  try {
    const { data, error } = await db()
      .from('factories')
      .select('id,name,address,dong,coord_verified,n_waste_types')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      name: data.name,
      address: data.address ?? '',
      dong: data.dong ?? null,
      coord_verified: typeof data.coord_verified === 'boolean' ? data.coord_verified : null,
      n_waste_types: data.n_waste_types ?? undefined,
    };
  } catch {
    return null;
  }
}
