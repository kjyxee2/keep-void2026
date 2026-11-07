// 1분 진단 화면 상태와 규칙(순수 함수). 화면: app/diagnose, components/diagnose
// 값은 서버 응답과 사용자가 넣은 값만 쓴다. 서류에서 처리 방식을 짐작하지 않는다.
import type { Method, WeightSource } from './types';

export type Step = 0 | 1 | 2 | 3;

/** 서류 사진에서 읽어 사용자가 "이 값으로 입력"을 누른 값 */
export type DocValues = {
  document_type: string;
  weight_kg: number | null;
  chip_id: string | null;
  chip_label: string | null;
  waste_type_raw: string | null;
  processor_id: string | null;
  /** 지금 맡기는 곳. 목록 이름(processor_name)이 있으면 그것, 없으면 서류 글자 그대로 */
  processor_name: string | null;
};

export type PickedFactory = {
  id: string;
  name: string;
  address: string;
  dong: string | null;
  coord_verified: boolean | null;
  n_waste_types?: number;
};

export type Draft = {
  v: 1;
  diagnosisId: string;
  chipId: string;
  step: Step;
  weight: string;
  weightSource: WeightSource | null;
  method: Method | null;
  processorName: string;
  factory: PickedFactory | null;
  doc: DocValues | null;
  updatedAt: number;
};

// ---------- 무게 입력 ----------

export const WEIGHT_MAX_KG = 10_000_000; // 서버 검사(lib/validate.ts)와 같은 상한

/** "2,480" 같은 입력을 정수 kg로. 숫자가 아니면 null */
export function parseWeight(raw: string): number | null {
  const s = raw.replace(/[,\s]/g, '');
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

/** 칸 바로 아래에 보일 오류 문구. 문제가 없으면 null */
export function weightError(raw: string): string | null {
  if (raw.trim() === '') return '한 달 배출 무게를 넣어 주세요.';
  const n = parseWeight(raw);
  if (n === null) return '숫자만 넣어 주세요. 소수점 없이 kg 단위예요.';
  if (n <= 0) return '0보다 큰 무게를 넣어 주세요.';
  if (n > WEIGHT_MAX_KG) return `${WEIGHT_MAX_KG.toLocaleString('ko-KR')}kg 이하로 넣어 주세요.`;
  return null;
}

/** 입력 중 천 단위 쉼표. 숫자 말고는 지운다 */
export function formatWeightInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export const fmtKg = (n: number) => `${n.toLocaleString('ko-KR')}kg`;

// ---------- 서류 판독 확인 정도(docs/api.md 화면 안내) ----------

export type ConfidenceLevel = { level: 3 | 2 | 1; text: string };

export function confidenceLevel(value: number | null | undefined): ConfidenceLevel | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  if (value >= 0.85) return { level: 3, text: '또렷하게 읽음' };
  if (value >= 0.6) return { level: 2, text: '한 번 더 확인' };
  return { level: 1, text: '흐릿함, 꼭 확인' };
}

/** 서류 종류가 무게 출처 선택지와 바로 같을 때만 고른다. 그 밖에는 사용자가 고른다 */
export function weightSourceFromDocument(documentType: string | null | undefined): WeightSource | null {
  if (documentType === '계량표') return '계량표';
  if (documentType === '인계서') return '올바로 인계서';
  return null;
}

// ---------- 처리 방식 표시 ----------

export const METHOD_LABEL: Record<Method, string> = {
  소각: '소각 업체에 맡김',
  매립: '매립 업체에 맡김',
  에너지회수: '에너지회수 업체에 맡김',
  모름: '잘 모르겠어요',
};

export function methodSummary(method: Method | null): string | null {
  if (!method) return null;
  return method === '모름' ? '처리 방식 모름' : `${method} 업체`;
}

// ---------- 저장(브라우저). 접근이 막히면 조용히 넘어간다 ----------

const DRAFT_PREFIX = 'refit:diagnose:draft:';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function store(): StorageLike | null {
  try {
    return (globalThis as { localStorage?: StorageLike }).localStorage ?? null;
  } catch {
    return null;
  }
}

const STEPS: readonly Step[] = [0, 1, 2, 3];
const METHODS: readonly Method[] = ['소각', '매립', '에너지회수', '모름'];
const SOURCES: readonly WeightSource[] = ['계량표', '올바로 인계서', '기타'];

/** 저장된 값은 믿지 않고 모양을 다시 확인한다(다른 탭, 옛 버전, 손으로 고친 값) */
export function parseDraft(raw: string | null, diagnosisId: string): Draft | null {
  if (!raw) return null;
  let d: unknown;
  try {
    d = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  if (o.v !== 1 || o.diagnosisId !== diagnosisId || typeof o.chipId !== 'string') return null;
  const step = STEPS.includes(o.step as Step) ? (o.step as Step) : 2;
  const str = (x: unknown, max = 200) => (typeof x === 'string' ? x.slice(0, max) : '');
  const f = o.factory as Record<string, unknown> | null;
  const factory: PickedFactory | null =
    f && typeof f === 'object' && typeof f.id === 'string' && typeof f.name === 'string'
      ? {
          id: f.id,
          name: str(f.name),
          address: str(f.address),
          dong: typeof f.dong === 'string' ? f.dong : null,
          coord_verified: typeof f.coord_verified === 'boolean' ? f.coord_verified : null,
        }
      : null;
  const doc = o.doc && typeof o.doc === 'object' ? (o.doc as DocValues) : null;
  return {
    v: 1,
    diagnosisId,
    chipId: o.chipId,
    step: step === 0 ? 1 : step,
    weight: formatWeightInput(str(o.weight, 20)),
    weightSource: SOURCES.includes(o.weightSource as WeightSource) ? (o.weightSource as WeightSource) : null,
    method: METHODS.includes(o.method as Method) ? (o.method as Method) : null,
    processorName: str(o.processorName),
    factory,
    doc: doc && typeof doc.document_type === 'string' ? doc : null,
    updatedAt: typeof o.updatedAt === 'number' ? o.updatedAt : 0,
  };
}

export const draftStore = {
  load(diagnosisId: string): Draft | null {
    try {
      return parseDraft(store()?.getItem(DRAFT_PREFIX + diagnosisId) ?? null, diagnosisId);
    } catch {
      return null;
    }
  },
  save(draft: Draft) {
    try {
      store()?.setItem(DRAFT_PREFIX + draft.diagnosisId, JSON.stringify(draft));
    } catch {
      /* 저장이 막혀도 화면 진행에는 지장 없음 */
    }
  },
  remove(diagnosisId: string) {
    try {
      store()?.removeItem(DRAFT_PREFIX + diagnosisId);
    } catch {
      /* 무시 */
    }
  },
};

export const isFactoryId = (s: string | null | undefined): s is string => !!s && /^F\d{1,6}$/.test(s);
export const isDiagnosisId = (s: string | null | undefined): s is string =>
  !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
