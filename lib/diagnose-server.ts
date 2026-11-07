// 진단 화면(app/diagnose/page.tsx, 서버 컴포넌트) 전용 읽기. 서비스 키를 쓰는 lib/server를 거치므로 클라이언트에서 import 금지.
// 공개 칩 목록만 읽는다. ?factory= 공장은 화면이 GET /api/factories/:id로 받는다.
import { db } from './server';
import type { Chip } from './types';

export async function loadChips(): Promise<Chip[] | null> {
  try {
    const { data, error } = await db().from('waste_chips').select('*').order('id');
    if (error || !data) return null;
    return data as Chip[];
  } catch {
    return null; // 화면이 브라우저에서 /api/chips로 다시 받는다
  }
}
