// 공급자 공통 후처리. 모델 출력은 신뢰하지 않는 입력으로 보고 모양을 다시 검사한다.
// 규칙: 서류에 적힌 값만 남기고, 없거나 이상하면 null. 금액은 다루지 않는다.

export const DOCUMENT_TYPES = ['계량표', '인계서', '기타', '판독불가'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export type OcrFields = {
  document_type: DocumentType;
  weight_kg: number | null;
  weight_unit_raw: string | null;
  waste_type_raw: string | null;
  processor_name_raw: string | null;
  transporter_name_raw: string | null;
  date_raw: string | null;
  confidence: { weight_kg: number; waste_type_raw: number; processor_name_raw: number };
  evidence: {
    weight_kg: string | null; waste_type_raw: string | null; processor_name_raw: string | null;
    transporter_name_raw: string | null; date_raw: string | null;
  };
};

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
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});

// 근거 글자에 그 숫자가 실제로 보이는지(천 단위 쉼표, 공백 무시)
function evidenceShows(evidence: string | null, value: number) {
  if (!evidence) return false;
  const digits = evidence.normalize('NFKC').replace(/[,\s]/g, '');
  const n = String(value);
  return new RegExp(`(^|[^0-9.])${n.replace('.', '\\.')}(\\.0+)?([^0-9]|$)`).test(digits);
}

export function normalizeExtraction(input: unknown): OcrFields {
  const r = obj(input);
  const c = obj(r.confidence), e = obj(r.evidence);
  const docType = DOCUMENT_TYPES.includes(r.document_type as DocumentType) ? r.document_type as DocumentType : '판독불가';

  const empty: OcrFields = {
    document_type: docType, weight_kg: null, weight_unit_raw: null, waste_type_raw: null, processor_name_raw: null,
    transporter_name_raw: null, date_raw: null,
    confidence: { weight_kg: 0, waste_type_raw: 0, processor_name_raw: 0 },
    evidence: { weight_kg: null, waste_type_raw: null, processor_name_raw: null, transporter_name_raw: null, date_raw: null },
  };
  if (docType === '판독불가') return empty;

  const unitRaw = text(r.weight_unit_raw);
  const weightEvidence = text(e.weight);
  const value = typeof r.weight_value === 'number' && Number.isFinite(r.weight_value) && r.weight_value > 0 ? r.weight_value : null;
  const factor = unitFactor(unitRaw);
  const weightKg = value !== null && factor !== null && evidenceShows(weightEvidence, value)
    ? Math.round(value * factor * 1000) / 1000
    : null;

  return {
    document_type: docType,
    weight_kg: weightKg,
    weight_unit_raw: unitRaw,
    waste_type_raw: text(r.waste_type_raw),
    processor_name_raw: text(r.processor_name_raw),
    transporter_name_raw: text(r.transporter_name_raw),
    date_raw: text(r.date_raw),
    confidence: {
      weight_kg: weightKg === null ? 0 : unit01(c.weight),
      waste_type_raw: unit01(c.waste_type),
      processor_name_raw: unit01(c.processor_name),
    },
    evidence: {
      weight_kg: weightEvidence,
      waste_type_raw: text(e.waste_type),
      processor_name_raw: text(e.processor_name),
      transporter_name_raw: text(e.transporter_name),
      date_raw: text(e.date),
    },
  };
}
