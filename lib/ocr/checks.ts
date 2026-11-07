// 서버 검사 규칙(공급자 공통). 모델의 confidence 대신, 근거(evidence)에 적힌 항목명(라벨)과 값 모양으로 칸마다
// "확인됨" / "확인 필요"를 매긴다. 라벨은 근거 글자에서 값을 뺀 나머지로만 본다(업체 이름 속 '운송', '처리'는 무시).

export type Check = '확인됨' | '확인 필요';
export type Role = 'processor' | 'transporter' | 'emitter' | 'ambiguous' | 'none';
export type Flag =
  | 'role_swapped' | 'role_conflict' | 'same_company'
  | 'waste_category_only' | 'waste_label_mismatch'
  | 'weight_not_net' | 'weight_unit_unshown'
  | 'date_future' | 'date_too_old';

// NFKC, 공백 제거. '실 중 량' → '실중량', ㈜ → (주)
export const squash = (s: string) => s.normalize('NFKC').replace(/\s+/g, '');

// 근거에서 값을 뺀 라벨. 근거에 값이 보이지 않으면 null
export function labelOf(evidence: string | null, value: string | null): string | null {
  if (!evidence || !value) return null;
  const e = squash(evidence), v = squash(value);
  if (!v || !e.includes(v)) return null;
  return e.replace(v, '').replace(/[:：\-–=|·.,()[\]]+/g, '');
}

const PROC = /처리|인수|반입|수탁/;
const TRANS = /운반|운송|수집/;
const EMIT = /배출|거래처|발생|인계자/;

export function roleOfLabel(label: string | null): Role {
  if (!label) return 'none';
  const l = squash(label);
  const p = PROC.test(l), t = TRANS.test(l), e = EMIT.test(l);
  if (p && t) return 'ambiguous';
  if (p) return 'processor';
  if (t) return 'transporter';
  if (e) return 'emitter';
  return 'none';
}

// 상호처럼 보이는지: 글자 2자 이상, 숫자, 기호만은 아님
export const looksLikeName = (s: string) => /[\p{L}]{2,}/u.test(squash(s).replace(/\((주|유|합|재|사)\)/g, ''));

// 폐기물 '구분'(분류) 값. 종류 칸이 아니라 waste_category_raw로 보낸다
const CATEGORY = new Set(['사업장일반폐기물', '사업장배출시설계폐기물', '사업장생활계폐기물', '지정폐기물', '건설폐기물',
  '생활폐기물', '일반폐기물', '사업장폐기물', '의료폐기물', '사업장지정폐기물']);
export const isWasteCategory = (s: string) => CATEGORY.has(squash(s));

const WASTE_LABEL = /폐기물(의)?종류|^종류|품명|품목|폐기물명|폐기물의명칭/;
export const isWasteLabel = (label: string) => WASTE_LABEL.test(squash(label));

// 순중량 라벨(계량표 실중량, 순중량, 정미중량 / 인계서 위탁량, 인수량, 인계량 / 관리대장 처리량)
const NET = /실중량|순중량|정미중량|정미|위탁량|인수량|인계량|처리량|반입량|계량값/;
const GROSS = /총중량|공차중량|공차|1차|2차|차량중량/;
export type WeightLabel = 'net' | 'gross' | 'none';
export function weightLabelOf(evidence: string | null): WeightLabel {
  if (!evidence) return 'none';
  const e = squash(evidence);
  if (NET.test(e)) return 'net';
  if (GROSS.test(e)) return 'gross';
  return 'none';
}

// 근거 글자에 그 단위가 보이는지(kg 계열 / 톤 계열)
export function unitShown(text: string | null, factor: 1 | 1000): boolean {
  if (!text) return false;
  const t = text.normalize('NFKC').toLowerCase();
  return factor === 1 ? /kg|킬로/.test(t) : /톤|ton|(^|[^a-z])t([^a-z]|$)/.test(t);
}

const DATE_LABEL = /일자|일시|날짜|연월일|계량일|인계일|인수일|입고일|반입일|처리일|^일$/;
export const isDateLabel = (label: string) => DATE_LABEL.test(squash(label));

// 서류 날짜 → YYYY-MM-DD. 연-월-일 순서만. 없는 날짜는 null
export function parseDocDate(s: string | null): string | null {
  if (!s) return null;
  const d = s.normalize('NFKC').match(/\d+/g);
  if (!d || d.length < 3) return null;
  let y = Number(d[0]);
  const m = Number(d[1]), day = Number(d[2]);
  if (d[0].length === 2) y += 2000;
  else if (d[0].length !== 4) return null;
  const dt = new Date(Date.UTC(y, m - 1, day));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== day) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export const MAX_DATE_AGE_DAYS = 400;
// 한국 시각 기준 오늘과 비교
export function dateFlag(iso: string, now: Date): 'date_future' | 'date_too_old' | null {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  const today = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
  const [y, m, d] = iso.split('-').map(Number);
  const days = (today - Date.UTC(y, m - 1, d)) / 86_400_000;
  if (days < 0) return 'date_future';
  if (days > MAX_DATE_AGE_DAYS) return 'date_too_old';
  return null;
}

// Route에서 칩 연결 결과를 확인 신호로 더한다: 목록에 연결되지 않은 종류는 '확인 필요'
export function withChipCheck<T extends { check: { waste_type_raw: Check } }>(fields: T, chipId: string | null): T {
  if (chipId) return fields;
  return { ...fields, check: { ...fields.check, waste_type_raw: '확인 필요' } };
}

// 처리업체 목록에 연결되지 않은 상호는 철자를 확인할 수 없으므로 '확인 필요'
export function withProcessorCheck<T extends { check: { processor_name_raw: Check } }>(fields: T, processorId: string | null): T {
  if (processorId) return fields;
  return { ...fields, check: { ...fields.check, processor_name_raw: '확인 필요' } };
}
