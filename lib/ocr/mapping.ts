// 서류에서 읽은 글자를 우리 목록(waste_chips, processors)에 연결. 공급자 공통.
// 정확히 같거나 정규화 후 같을 때만 연결한다. 부분 일치, 유사도 매칭은 하지 않는다.
// 같은 키가 둘 이상을 가리키면 모호하므로 연결하지 않는다(null).

export const normKey = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');

// 법인 표기만 뗀다: (주), 주식회사, (유), 유한회사 등. NFKC로 ㈜는 (주)가 된다
const CORP = /\((주|유|합|재|사)\)|주식회사|유한회사|합자회사|합명회사|재단법인|사단법인/g;
const corpKey = (s: string) => normKey(s.normalize('NFKC').replace(CORP, ''));

type Index<T> = Map<string, T | null>;   // null = 모호

function put<T>(idx: Index<T>, key: string, val: T, same: (a: T, b: T) => boolean) {
  if (!key) return;
  const prev = idx.get(key);
  if (prev === undefined) idx.set(key, val);
  else if (prev !== null && !same(prev, val)) idx.set(key, null);
}

export type ChipRow = { id: string; label: string; waste_group: string | null };
export type WasteTypeRow = { waste_type: string | null; waste_group: string | null };

// 칩 label, 칩 waste_group, 신고 자료(flows)의 waste_type 원 표기 → 그 waste_group의 칩
export function buildChipIndex(chips: ChipRow[], wasteTypes: WasteTypeRow[]): Index<string> {
  const idx: Index<string> = new Map();
  const byGroup = new Map<string, string | null>();
  for (const c of chips) {
    put(idx, normKey(c.label), c.id, (a, b) => a === b);
    if (c.waste_group) {
      put(idx, normKey(c.waste_group), c.id, (a, b) => a === b);
      byGroup.set(c.waste_group, byGroup.has(c.waste_group) && byGroup.get(c.waste_group) !== c.id ? null : c.id);
    }
  }
  for (const w of wasteTypes) {
    const id = w.waste_group ? byGroup.get(w.waste_group) : undefined;
    if (w.waste_type && id) put(idx, normKey(w.waste_type), id, (a, b) => a === b);
  }
  return idx;
}

export const matchChip = (idx: Index<string>, raw: string | null) => (raw ? idx.get(normKey(raw)) ?? null : null);

export type ProcessorRow = { id: string; name: string; name_variants: string[] | null };
export type ProcessorMatch = { id: string; name: string };

export function buildProcessorIndex(procs: ProcessorRow[]): Index<ProcessorMatch> {
  const idx: Index<ProcessorMatch> = new Map();
  for (const p of procs) {
    const v = { id: p.id, name: p.name };
    for (const n of [p.name, ...(Array.isArray(p.name_variants) ? p.name_variants : [])]) {
      if (typeof n === 'string') put(idx, corpKey(n), v, (a, b) => a.id === b.id);
    }
  }
  return idx;
}

export const matchProcessor = (idx: Index<ProcessorMatch>, raw: string | null) =>
  raw ? idx.get(corpKey(raw)) ?? null : null;
