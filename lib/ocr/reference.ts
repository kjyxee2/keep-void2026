// 이름 연결에 쓰는 참고 목록(칩, 신고 폐기물 종류, 처리업체)을 읽어 인스턴스 메모리에 잠시 둔다. 서버 전용.
import { db, fetchAll } from '../server';
import { buildChipIndex, buildProcessorIndex, type ChipRow, type ProcessorRow, type WasteTypeRow } from './mapping';

const TTL_MS = 10 * 60 * 1000;   // 참고 데이터는 데모 데이터 교체 때만 바뀐다
let cache: { at: number; value: Promise<Reference> } | null = null;

export type Reference = {
  chips: ReturnType<typeof buildChipIndex>;
  chipLabels: Map<string, string>;
  processors: ReturnType<typeof buildProcessorIndex>;
};

async function load(): Promise<Reference> {
  const [chips, wasteTypes, procs] = await Promise.all([
    db().from('waste_chips').select('id, label, waste_group').order('id').then(r => { if (r.error) throw r.error; return r.data as ChipRow[]; }),
    fetchAll<WasteTypeRow>((from, to, opts) => db().from('flows').select('waste_type, waste_group', opts).order('link_id').range(from, to)),
    fetchAll<ProcessorRow>((from, to, opts) => db().from('processors').select('id, name, name_variants', opts).order('id').range(from, to)),
  ]);
  return {
    chips: buildChipIndex(chips, wasteTypes),
    chipLabels: new Map(chips.map(c => [c.id, c.label])),
    processors: buildProcessorIndex(procs),
  };
}

export function loadReference(): Promise<Reference> {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const value = load();
    cache = { at: Date.now(), value };
    value.catch(() => { if (cache?.value === value) cache = null; });   // 실패는 캐시하지 않음
  }
  return cache.value;
}
