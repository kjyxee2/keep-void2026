import {
  dateFlag, isDateLabel, isWasteCategory, isWasteLabel, labelOf, looksLikeName, parseDocDate, roleOfLabel, unitShown,
  weightLabelOf, type Check, type Flag,
} from './checks.ts';

// 공급자 공통 후처리. 모델 출력은 신뢰하지 않는 입력으로 보고 모양을 다시 검사한다.
// 규칙: 서류에 적힌 값만 남기고, 없거나 이상하면 null. 금액은 다루지 않는다.

export const DOCUMENT_TYPES = ['계량표', '인계서', '기타', '판독불가'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const UNIT_SOURCES = ['숫자 옆', '단위 칸', '표 머리글'] as const;
export type UnitSource = (typeof UNIT_SOURCES)[number];

type FieldKey = 'weight_kg' | 'waste_type_raw' | 'processor_name_raw' | 'transporter_name_raw' | 'date_raw';

export type OcrFields = {
  document_type: DocumentType;
  weight_kg: number | null;
  weight_unit_raw: string | null;
  weight_unit_source: UnitSource | null;          // 단위를 읽은 곳
  waste_type_raw: string | null;
  waste_category_raw: string | null;              // '구분' 칸(사업장일반폐기물 등). 종류가 아님
  processor_name_raw: string | null;
  transporter_name_raw: string | null;
  date_raw: string | null;
  // 화면용: 서버 규칙(근거 라벨 + 값 모양)으로 매긴 칸별 확인 표시. 모델 confidence는 쓰지 않는다
  check: Record<FieldKey, Check>;
  flags: Flag[];
  needs_review: boolean;
  evidence: Record<FieldKey | 'weight_unit', string | null>;
  // 내부용: 모델이 매긴 값. 틀린 값에도 높게 나와(평가 README 7절) 화면에 내보내지 않는다(publicFields)
  model_confidence: { weight_kg: number; waste_type_raw: number; processor_name_raw: number };
};

export type PublicOcrFields = Omit<OcrFields, 'model_confidence'>;
export function publicFields(f: OcrFields): PublicOcrFields {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { model_confidence, ...rest } = f;
  return rest;
}

const MAX_TEXT = 200;
const KG = new Set(['kg', '㎏', '킬로그램', '킬로']);
const TON = new Set(['t', '톤', 'ton', 'tons']);

// 단위 환산은 서류에 kg 또는 톤이 적혀 있을 때만(1톤 = 1000kg). 그 밖의 단위는 null
export function unitFactor(unit: string | null): 1 | 1000 | null {
  if (typeof unit !== 'string') return null;
  const u = unit.normalize('NFKC').trim().toLowerCase();
  if (KG.has(u)) return 1;
  if (TON.has(u)) return 1000;
  return null;
}

const text = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s.slice(0, MAX_TEXT) : null;
};
const unit01 = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const corpless = (s: string) => s.normalize('NFKC').replace(/\((주|유|합|재|사)\)|주식회사|유한회사/g, '').replace(/[\s\p{P}\p{S}]/gu, '');
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});

// 근거 글자에 그 숫자가 실제로 보이는지(천 단위 쉼표, 공백 무시)
function evidenceShows(evidence: string | null, value: number) {
  if (!evidence) return false;
  const digits = evidence.normalize('NFKC').replace(/[,\s]/g, '');
  const n = String(value);
  return new RegExp(`(^|[^0-9.])${n.replace('.', '\\.')}(\\.0+)?([^0-9]|$)`).test(digits);
}

const NEEDS: Check = '확인 필요', OK: Check = '확인됨';
const checkOf = (pass: boolean): Check => (pass ? OK : NEEDS);

export function normalizeExtraction(input: unknown, opts: { now?: Date } = {}): OcrFields {
  const now = opts.now ?? new Date();
  const r = obj(input);
  const c = obj(r.confidence), e = obj(r.evidence);
  const docType = DOCUMENT_TYPES.includes(r.document_type as DocumentType) ? r.document_type as DocumentType : '판독불가';
  const flags = new Set<Flag>();

  const allNeeds = { weight_kg: NEEDS, waste_type_raw: NEEDS, processor_name_raw: NEEDS, transporter_name_raw: NEEDS, date_raw: NEEDS };
  const empty: OcrFields = {
    document_type: docType, weight_kg: null, weight_unit_raw: null, weight_unit_source: null,
    waste_type_raw: null, waste_category_raw: null, processor_name_raw: null, transporter_name_raw: null, date_raw: null,
    check: allNeeds, flags: [], needs_review: false,
    evidence: { weight_kg: null, weight_unit: null, waste_type_raw: null, processor_name_raw: null, transporter_name_raw: null, date_raw: null },
    model_confidence: { weight_kg: 0, waste_type_raw: 0, processor_name_raw: 0 },
  };
  if (docType === '판독불가') return empty;

  // ── 무게: 순중량 라벨, 근거에 숫자, 단위는 근거(숫자 옆, 단위 칸, 표 머리글)에 보일 때만 ──
  const unitRaw = text(r.weight_unit_raw);
  const unitSource = UNIT_SOURCES.includes(r.weight_unit_source as UnitSource) ? r.weight_unit_source as UnitSource : null;
  const weightEvidence = text(e.weight);
  const unitEvidence = text(e.weight_unit);
  const value = typeof r.weight_value === 'number' && Number.isFinite(r.weight_value) && r.weight_value > 0 ? r.weight_value : null;
  const factor = unitFactor(unitRaw);
  const wLabel = weightLabelOf(weightEvidence);
  let weightKg: number | null = null;
  if (value !== null && evidenceShows(weightEvidence, value)) {
    if (wLabel === 'gross') flags.add('weight_not_net');
    else if (factor !== null) {
      if (unitShown(weightEvidence, factor) || unitShown(unitEvidence, factor)) weightKg = Math.round(value * factor * 1000) / 1000;
      else flags.add('weight_unit_unshown');
    }
  }

  // ── 폐기물 종류: '구분' 값은 분류로 옮기고, 종류가 아닌 칸에서 읽은 값은 버린다 ──
  let wasteType = text(r.waste_type_raw);
  let wasteCategory = text(r.waste_category_raw);
  const wasteEvidence = text(e.waste_type);
  if (wasteType && isWasteCategory(wasteType)) {
    wasteCategory = wasteCategory ?? wasteType;
    wasteType = null;
    flags.add('waste_category_only');
  }
  const wasteLabel = labelOf(wasteEvidence, wasteType);
  if (wasteType && wasteLabel && !isWasteLabel(wasteLabel)) { wasteType = null; flags.add('waste_label_mismatch'); }
  const wasteOk = !!wasteType && !!wasteLabel && isWasteLabel(wasteLabel) && looksLikeName(wasteType);

  // ── 처리업체, 운반업체: 근거 라벨로 역할 확인 ──
  let proc = text(r.processor_name_raw), trans = text(r.transporter_name_raw);
  let procEv = text(e.processor_name), transEv = text(e.transporter_name);
  let pRole = roleOfLabel(labelOf(procEv, proc)), tRole = roleOfLabel(labelOf(transEv, trans));
  let swapped = false;
  if (proc && trans && pRole === 'transporter' && tRole === 'processor') {
    [proc, trans, procEv, transEv, pRole, tRole] = [trans, proc, transEv, procEv, tRole, pRole];
    swapped = true;
    flags.add('role_swapped');
  } else if ((proc && ['transporter', 'emitter'].includes(pRole)) || (trans && ['processor', 'emitter'].includes(tRole))) {
    proc = trans = null;
    flags.add('role_conflict');
  }
  const same = !!proc && !!trans && corpless(proc) === corpless(trans);
  if (same) flags.add('same_company');
  const procOk = !!proc && pRole === 'processor' && looksLikeName(proc) && !swapped && !same;
  const transOk = !!trans && tRole === 'transporter' && looksLikeName(trans) && !swapped && !same;

  // ── 날짜: 날짜 라벨, 실제 있는 날짜, 미래이거나 400일보다 오래되면 확인 ──
  const date = text(r.date_raw), dateEv = text(e.date);
  const iso = parseDocDate(date);
  const dFlag = iso ? dateFlag(iso, now) : null;
  if (dFlag) flags.add(dFlag);
  const dateLabel = labelOf(dateEv, date);
  const dateOk = !!iso && !dFlag && !!dateLabel && isDateLabel(dateLabel);

  const flagList = [...flags];
  return {
    document_type: docType,
    weight_kg: weightKg,
    weight_unit_raw: unitRaw,
    weight_unit_source: unitSource,
    waste_type_raw: wasteType,
    waste_category_raw: wasteCategory,
    processor_name_raw: proc,
    transporter_name_raw: trans,
    date_raw: date,
    check: {
      weight_kg: checkOf(weightKg !== null && wLabel === 'net'),
      waste_type_raw: checkOf(wasteOk),
      processor_name_raw: checkOf(procOk),
      transporter_name_raw: checkOf(transOk),
      date_raw: checkOf(dateOk),
    },
    flags: flagList,
    needs_review: flagList.length > 0,
    evidence: {
      weight_kg: weightEvidence,
      weight_unit: unitEvidence,
      waste_type_raw: wasteType ? wasteEvidence : null,
      processor_name_raw: proc ? procEv : null,
      transporter_name_raw: trans ? transEv : null,
      date_raw: dateEv,
    },
    model_confidence: {
      weight_kg: weightKg === null ? 0 : unit01(c.weight),
      waste_type_raw: unit01(c.waste_type),
      processor_name_raw: unit01(c.processor_name),
    },
  };
}
