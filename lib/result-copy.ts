// 결과, 연결 요청 화면 문구와 작은 규칙(순수 함수). 숫자는 API 값을 그대로 쓰고 여기서 계산하지 않는다.

/** 받침 있으면 "을", 없으면 "를" */
export function objectParticle(word: string) {
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return '를';
  return (last - 0xac00) % 28 ? '을' : '를';
}

export const SOURCE_REPORTS = '안산시 폐기물 배출자 신고현황 2026-07';

export const num = (n: number) => n.toLocaleString('ko-KR');

/** 처리 방식 원 표기 → 막대, 범례 종류. 모양과 글자 라벨을 같이 써서 색만으로 뜻을 전하지 않는다 */
export type RouteKind = 'burn' | 'recycle' | 'landfill' | 'process' | 'unknown';
export function routeKind(method: string): RouteKind {
  if (method === '소각' || method === '에너지회수') return 'burn';
  if (method === '물질재활용' || method === '원료 재활용' || method === '재활용') return 'recycle';
  if (method === '매립') return 'landfill';
  if (method.startsWith('중간가공') || method.includes('중간처분')) return 'process';
  return 'unknown';
}

/**
 * 요약 문장(숫자 없음). 지역은 지금 맡기는 처리업체를 목록에서 알 때(processors.sigungu)만 쓴다.
 * 처리업체 이름만 적었거나 모르면 지역 없이 쓴다(짐작하지 않음).
 */
export function summaryLines(
  currentMethod: string,
  hasCandidates: boolean,
  processor?: { sigungu: string | null } | null,
): [string, string] {
  const where = processor?.sigungu ? `${processor.sigungu}의 ` : '';
  const first =
    currentMethod === '모름'
      ? '지금 처리 방식은 모른다고 하셨어요.'
      : `지금은 ${where}${currentMethod} 업체로 보내고 있어요.`;
  const second = hasCandidates ? '같은 폐기물을 원료로 받는 업체가 있어요.' : '아직 원료로 보내는 기록이 없는 폐기물이에요.';
  return [first, second];
}

/** 연결 요청 완료 화면 배지. 진단에 고른 신고 공장의 실제 동이 있을 때만(없으면 배지 없이 기본 문구) */
export const circularBadge = (dong: string | null | undefined) => (dong ? `RE:FIT 순환 공장 ${dong}` : null);

/** 안산 안 후보 카드(결정 A). 순위는 그대로 두고 후보 목록 아래 한 칸 */
export const ANSAN_CANDIDATE = {
  tag: '안산 안 업체',
  lead: '안산에서 나온 자원을 안산 안에서 받는 업체예요. 근거는 위 후보보다 적을 수 있어요.',
  none: '같은 폐기물을 재활용으로 받는 안산 업체가 아직 없어요',
  title: '안산 안 후보',
};

/** 후보 카드 근거 한 줄(Figma v2 76:168 Candidate Card Evidence). 숫자는 API neighbors 그대로 */
export const candidateEvidence = (neighbors: number) => `이 업체에 원료 재활용으로 보내는 안산 공장 ${num(neighbors)}곳`;

/** 요약 이웃 수 문구(Figma v2 76:283). 폐기물 이름은 머리 줄에 이미 있어 되풀이하지 않는다 */
export const NEIGHBORS_BURN_LABEL = '소각 쪽으로 보내는 안산 공장';
export const NEIGHBORS_RECYCLE_LABEL = '재활용 업체로 보내는 안산 공장';

/** Main 끝의 페이지 각주 한 줄(Figma v2 277:3887). 구간별 각주를 대신한다 */
export const PAGE_FOOTNOTE = '안산시 폐기물 배출자 신고현황 2026-07, 환경부 고시 처리단가 2022 (실제 계약가 아님, 절감액은 계산하지 않음)';

/** 접힌 원문을 여는 글자 버튼(Figma v2 Toggle) */
export const DETAIL_TOGGLE = { open: '자세히 보기', close: '접기' };

/**
 * 같이 맡기기 한 줄(Figma v2 76:302 "폐합성수지를 내는 성곡동 공장 10곳, 처리업체 20곳").
 * 값은 GET /api/groups 원값. 동을 모르면 "가까운 공장"(Figma 130:1478 표현)
 */
export const groupSummary = (chip: string, dong: string | null | undefined, nFactories: number, nProcessors: number) =>
  `${chip}${objectParticle(chip)} 내는 ${dong ? `${dong} ` : '가까운 '}공장 ${num(nFactories)}곳, 처리업체 ${num(nProcessors)}곳`;

/** 같이 맡기기 원문(접힘 안). 값은 API 원값 */
export const groupDetail = (chip: string, nFactories: number, radiusKm: number, nProcessors: number) =>
  `${chip}${objectParticle(chip)} 내는 공장 ${num(nFactories)}곳이 묶음 중심에서 ${radiusKm}km 안에 있어요. 이 공장들은 지금 처리업체 ${num(nProcessors)}곳에 따로 맡기고 있어요. 물량을 묶으면 운반과 견적을 한 번에 받을 수 있어요.`;

/** 점 그림 설명(Figma v2 130:956). dots는 좌표가 확인된 공장 수 */
export const groupCaption = (dots: number) => `묶음 공장 ${num(dots)}곳, 실제 위치 (이름 비공개)`;

/** Figma 130:1414 빈 상태 */
export const EMPTY_CANDIDATES = {
  title: '아직 안산 공장이 원료로 보내는 기록이 없어요',
  body: '고시 단가 비교와 같이 맡기기만 보여 드려요.',
};

/** 업체 바꾸는 절차. 근거 research/waste/W20_처리업체변경절차.md (Figma 130:1299와 같은 문구) */
export const SWITCH_GUIDE = {
  title: '업체를 바꾸려면',
  lead: '처리 방법이 바뀌면 신고가 필요해요.',
  steps: [
    { title: '수탁처리능력확인서 받기', body: '계약 전에 새 업체에서 먼저 받아요. 처리업 허가증 사본이 함께 붙어 와요.' },
    { title: '적법한 업체인지 확인', body: '폐기물적정처리추진센터 공개 자료로 허가 업종과 영업 범위를 확인해요.' },
    { title: '위탁 계약', body: '허가 업종과 영업 범위에 맞게 운반, 처리 위탁 계약서를 써요.' },
    {
      title: '배출자 변경신고',
      body: '소각에서 재활용처럼 처리 방법이 바뀌면 1개월 안에 안산시에 신고해요. 같은 방법으로 업체만 바꾸면 신고 대상이 아니에요.',
    },
    { title: '올바로 전자인계서', body: '첫 반출부터 운반자에게 넘기기 전에 새 업체로 전자인계서를 작성해요.' },
  ],
  designated: {
    title: '지정폐기물은 30일 안에',
    body: '폐유 등 지정폐기물은 처리자만 바뀌어도 처리계획서와 수탁확인서를 다시 내야 해요.',
  },
  source: '배출자신고 업무처리지침 2025-12, 시행규칙 제18조',
  disclaimer: '절차 안내이며 법적 판단이 아닙니다. 최종 확인은 안산시 산단환경과에 해 주세요.',
};

// ---------- 연락처 ----------

/** 서버와 같은 형식(app/api/requests PHONE) + 휴대폰 앞자리 01x */
const MOBILE = /^01[016789]-?\d{3,4}-?\d{4}$/;

export function normalizePhone(raw: string): string | null {
  const v = raw.replace(/\s+/g, '').trim();
  if (!MOBILE.test(v)) return null;
  const d = v.replace(/-/g, '');
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

/** 화면 표시용: 가운데를 가린다(010-****-1234). 전체 번호는 저장하지 않는다 */
export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  return `${d.slice(0, 3)}-****-${d.slice(-4)}`;
}

// ---------- 같이 맡기기 묶음(GET /api/groups 실제 응답 모양) ----------

/**
 * 점 그림용 좌표 변환(표시만, 값은 바꾸지 않음): [lng, lat] → 중심 기준 km(동쪽 +x, 북쪽 +y).
 * 위도 1도 110.574km, 경도 1도 111.320km x cos(위도)
 */
export function toLocalKm([lng, lat]: [number, number], [clng, clat]: [number, number]): [number, number] {
  const x = (lng - clng) * 111.32 * Math.cos((clat * Math.PI) / 180);
  const y = (lat - clat) * 110.574;
  return [x, y];
}

// ---------- 공개 단가 표: 고시 2022 적용분과 2027 시행분 한 줄로 ----------

export type PriceRowIn = {
  id: string;
  category: string;
  item: string;
  method: string;
  price_won: number;
  unit: string;
  year: number;
  year_label?: string | null;
};
export type PriceRowOut<R extends PriceRowIn> = {
  /** 큰 숫자로 보여 줄 행: 2022 적용분, 없으면 2027 시행분, 고시가 아니면 그 행 */
  main: R;
  /** 같은 고시 항목의 2027 시행분(main이 2022일 때만) */
  next: R | null;
};

const NOW_LABEL = '2022 적용';
const NEXT_LABEL = '2027 시행';

/**
 * 같은 고시 항목(category, item, method 원문이 모두 같고 year_label이 2022 적용 또는 2027 시행)을 한 줄로 묶는다.
 * 원문 문자열이 완전히 같을 때만 묶고, 그 밖의 행은 그대로 한 줄씩. 순서는 처음 나온 순서. 값은 바꾸지 않는다.
 */
export function mergeNoticeYears<R extends PriceRowIn>(rows: R[]): PriceRowOut<R>[] {
  const out: PriceRowOut<R>[] = [];
  const byKey = new Map<string, PriceRowOut<R>>();
  for (const r of rows) {
    const label = r.year_label;
    if (label !== NOW_LABEL && label !== NEXT_LABEL) {
      out.push({ main: r, next: null });
      continue;
    }
    const key = JSON.stringify([r.category, r.item, r.method]);
    const found = byKey.get(key);
    if (!found) {
      const entry: PriceRowOut<R> = { main: r, next: null };
      byKey.set(key, entry);
      out.push(entry);
      continue;
    }
    if (label === NEXT_LABEL && found.main.year_label === NOW_LABEL && !found.next) found.next = r;
    else if (label === NOW_LABEL && found.main.year_label === NEXT_LABEL) {
      found.next = found.main;
      found.main = r;
    } else out.push({ main: r, next: null });
  }
  return out;
}
