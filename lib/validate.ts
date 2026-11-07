// PATCH /api/diagnoses/:id 입력 검증(순수 함수). 서버 계산 열(status, waste_group 등)은 받지 않는다
const ONE_OF = {
  current_method: ['소각', '매립', '에너지회수', '모름'],
  weight_source: ['계량표', '올바로 인계서', '기타'],
  location_source: ['주소', '현재위치', '신고공장'],
} as const;
const ID = /^[A-Za-z0-9_-]{1,20}$/;
const num = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const int = (v: unknown, max: number) => Number.isInteger(v) && num(v, 0, max);

export function validateDiagnosisPatch(b: Record<string, unknown>): [Record<string, unknown>, string | null] {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(b)) {
    if (k in ONE_OF) {
      if (v !== null && !(ONE_OF[k as keyof typeof ONE_OF] as readonly unknown[]).includes(v)) return [out, `${k} 값이 올바르지 않음`];
    } else if (k === 'weight_kg_per_month') {
      if (v !== null && !num(v, Number.MIN_VALUE, 1e7)) return [out, 'weight_kg_per_month는 0보다 큰 kg'];
    } else if (k === 'current_cost_won_per_month') {
      if (v !== null && !int(v, 1e11)) return [out, 'current_cost_won_per_month는 0 이상 정수(원)'];
    } else if (k === 'current_price_won_per_ton') {
      // integer 열(최대 2,147,483,647). 비교 표시용, 계산에 쓰지 않음
      if (v !== null && !int(v, 1e9)) return [out, 'current_price_won_per_ton는 0 이상 10억 이하 정수(원/톤)'];
    } else if (k === 'lat' || k === 'lng') {
      if (v !== null && !num(v, k === 'lat' ? -90 : -180, k === 'lat' ? 90 : 180)) return [out, `${k} 범위 오류`];
    } else if (k === 'factory_id' || k === 'volume_option_id') {
      if (v !== null && typeof v !== 'string') return [out, `${k}는 문자열`];
    } else if (k === 'current_processor_id') {
      // 있는지는 FK(processors.id)로 확인(라우트에서 23503 → 400)
      if (v !== null && (typeof v !== 'string' || !ID.test(v))) return [out, 'current_processor_id는 처리업체 id(예: P0065)'];
    } else if (k === 'current_processor_name_raw') {
      if (v !== null && typeof v !== 'string') return [out, 'current_processor_name_raw는 문자열'];
      const s = typeof v === 'string' ? v.trim() : null;
      if (s && s.length > 100) return [out, 'current_processor_name_raw는 100자 이하'];
      out[k] = s || null;
      continue;
    } else return [out, `수정할 수 없는 열: ${k}`];
    out[k] = v;
  }
  if (('lat' in out) !== ('lng' in out) || (out.lat === null) !== (out.lng === null)) return [out, 'lat, lng는 함께'];
  return [out, null];
}
