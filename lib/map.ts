// 지도 공장 점의 처리 방식(Figma 지도 설명 147:1794): 공장별로 신고(weight 합)가 가장 많은 방식 묶음
export type MapMethod = '재활용' | '소각' | '매립' | '미확인';
const ORDER: MapMethod[] = ['재활용', '소각', '매립', '미확인'];   // 동률일 때 앞이 이김

export function methodBucket(method: string | null): MapMethod {
  if (method === '물질재활용') return '재활용';
  if (method === '소각' || method === '에너지회수') return '소각';
  if (method === '매립') return '매립';
  return '미확인';
}

export function factoryMethods(flows: Array<{ factory_id: string | null; method: string | null; weight: number }>) {
  const sums = new Map<string, Record<MapMethod, number>>();
  for (const f of flows) {
    if (!f.factory_id) continue;
    const s = sums.get(f.factory_id) ?? { 재활용: 0, 소각: 0, 매립: 0, 미확인: 0 };
    s[methodBucket(f.method)] += f.weight;
    sums.set(f.factory_id, s);
  }
  const r = (x: number) => Math.round(x * 1e6);   // 1/k 합의 부동소수 오차로 동률이 깨지지 않게
  return new Map([...sums].map(([id, s]) =>
    [id, ORDER.reduce((best, m) => (r(s[m]) > r(s[best]) ? m : best), ORDER[0])]));
}
