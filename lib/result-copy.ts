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

/** 요약 문장(숫자 없음). 지역은 사용자의 지금 처리업체 위치를 모르므로 쓰지 않는다 */
export function summaryLines(currentMethod: string, hasCandidates: boolean): [string, string] {
  const first =
    currentMethod === '모름'
      ? '지금 처리 방식은 모른다고 하셨어요.'
      : currentMethod === '에너지회수'
        ? '지금은 에너지회수 업체로 보내고 있어요.'
        : `지금은 ${currentMethod} 업체로 보내고 있어요.`;
  const second = hasCandidates ? '같은 폐기물을 원료로 받는 업체가 있어요.' : '아직 원료로 보내는 기록이 없는 폐기물이에요.';
  return [first, second];
}

/** 후보 카드 근거 문구. 후보는 폐기물군 기준으로 세므로 "같은 폐기물군" */
export const candidateEvidence = (neighbors: number) =>
  `같은 폐기물군을 이 업체에 재활용으로 보내는 안산 공장 ${num(neighbors)}곳`;

/** 요약 이웃 수 문구. 칩(신고 원 표기) 기준 */
export const neighborsBurnLabel = (chip: string) => `${chip}${objectParticle(chip)} 소각 쪽으로 보내는 안산 공장`;
export const neighborsRecycleLabel = (chip: string) => `${chip}${objectParticle(chip)} 원료 재활용 업체로 보내는 안산 공장`;

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
  sourceBasis: '출처 (법령, 지침 원문)',
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

export type GroupPoint = { coordinates: [number, number]; self: boolean };
export type GroupItem = {
  group_id: string;
  waste_group: string;
  match: 'member' | 'dong';
  center: [number, number];
  radius_km: number;
  n_factories: number;
  n_processors: number;
  points: GroupPoint[];
  label?: string;
};
export type GroupsResponse = { groups: GroupItem[]; labels?: Record<string, string> };

/**
 * 점 그림용 좌표 변환(표시만, 값은 바꾸지 않음): [lng, lat] → 중심 기준 km(동쪽 +x, 북쪽 +y).
 * 위도 1도 110.574km, 경도 1도 111.320km x cos(위도)
 */
export function toLocalKm([lng, lat]: [number, number], [clng, clat]: [number, number]): [number, number] {
  const x = (lng - clng) * 111.32 * Math.cos((clat * Math.PI) / 180);
  const y = (lat - clat) * 110.574;
  return [x, y];
}
