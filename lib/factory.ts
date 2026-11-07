// GET /api/factories/:id 응답 모양(순수 함수). 공개 신고현황 열 중 화면에 필요한 것만 내보낸다(주소, 좌표 제외)
import type { FactoryPublic } from './types';

export const FACTORY_PUBLIC_COLUMNS = 'id,name,dong,waste_groups,coord_verified,n_waste_types';

export const isFactoryIdParam = (s: string) => /^F\d{1,6}$/.test(s);

export function publicFactory(row: Record<string, unknown>): FactoryPublic {
  return {
    id: String(row.id),
    name: String(row.name),
    dong: typeof row.dong === 'string' ? row.dong : null,
    waste_groups: Array.isArray(row.waste_groups) ? (row.waste_groups as string[]) : [],
    coord_verified: row.coord_verified === true,
    n_waste_types: typeof row.n_waste_types === 'number' ? row.n_waste_types : null,
  };
}
