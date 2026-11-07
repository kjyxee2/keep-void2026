// 지도 폐기물 칩. group은 GET /api/map의 group(폐기물군, GET /api/chips의 waste_group과 같은 값)
import type { WasteType } from '@/components/brand/Icon';

export type MapChip = {
  key: string;
  label: string;
  group: string | null;
  icon: WasteType | null;
};

export const MAP_CHIPS: MapChip[] = [
  { key: 'all', label: '전체', group: null, icon: null },
  {
    key: 'C01',
    label: '폐합성수지',
    group: '폐합성수지류',
    icon: '폐합성수지',
  },
  { key: 'C02', label: '폐수처리오니', group: '오니류', icon: '폐수처리오니' },
  {
    key: 'C03',
    label: '폐활성탄',
    group: '폐흡착제(활성탄 등)',
    icon: '폐활성탄',
  },
  { key: 'C04', label: '폐유', group: '폐유', icon: '폐유' },
];
