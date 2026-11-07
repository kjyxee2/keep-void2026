// 같이 맡기기 묶음(group_fit) 찾기와 화면용 모양(순수 함수). 공장 이름, id는 내보내지 않는다.
export type GroupRow = {
  group_id: string; waste_group: string | null; factory_ids: string[]; n: number;
  centroid_lat: number; centroid_lng: number; max_dist_km: number; dongs: string[]; n_distinct_processors: number;
};
export type GroupFactory = { id: string; dong: string | null; coord_verified: boolean | null; waste_groups: string[] | null };
export type GroupMatch = { group: GroupRow; match: 'member' | 'dong' };

// 공장이 든 묶음. 좌표가 확인되지 않은 공장은 묶음에 들 수 없으므로 같은 동 묶음 중 공장 수가 가장 많은 것(같으면 id 앞)
export function findGroups(factory: GroupFactory, groups: GroupRow[], wasteGroup: string | null): GroupMatch[] {
  const pool = wasteGroup ? groups.filter(g => g.waste_group === wasteGroup) : groups;
  const member = pool.filter(g => g.factory_ids.includes(factory.id));
  if (member.length || factory.coord_verified || !factory.dong) {
    return member.sort((a, b) => a.group_id.localeCompare(b.group_id)).map(group => ({ group, match: 'member' }));
  }
  const wanted = wasteGroup ? [wasteGroup] : (factory.waste_groups ?? []);
  return wanted.flatMap(wg => {
    const best = pool.filter(g => g.waste_group === wg && g.dongs.includes(factory.dong!))
      .sort((a, b) => b.n - a.n || a.group_id.localeCompare(b.group_id))[0];
    return best ? [{ group: best, match: 'dong' as const }] : [];
  });
}

export function groupView(m: GroupMatch, coords: Map<string, { lat: number; lng: number }>, selfId: string | null, dong?: string | null) {
  const { group: g, match } = m;
  return {
    group_id: g.group_id,
    waste_group: g.waste_group,
    match,
    center: [g.centroid_lng, g.centroid_lat] as [number, number],
    radius_km: g.max_dist_km,
    n_factories: g.n,
    n_processors: g.n_distinct_processors,
    points: g.factory_ids.flatMap(id => {
      const c = coords.get(id);
      return c ? [{ coordinates: [c.lng, c.lat] as [number, number], self: id === selfId }] : [];
    }),
    label: match === 'dong'
      ? `이 공장은 위치가 확인되지 않아 같은 동(${dong ?? '동 미확인'}) 묶음 중 공장이 가장 많은 묶음을 보여 줌(동 기준)`
      : '이 공장이 들어 있는 묶음',
  };
}
