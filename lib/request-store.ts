// 연결 요청 완료 화면용 요약을 이 브라우저에 저장한다(GET /api/requests/:id가 없어서).
// 전화번호는 가린 값만 저장한다. 저장이 막히면 메모리에 둔다.
import type { ConnectionRequest } from './types';

export type RequestSummary = {
  request: Pick<ConnectionRequest, 'id' | 'diagnosis_id' | 'candidate_id' | 'processor_id' | 'status' | 'join_group' | 'kakao_notify' | 'sla_due_at' | 'created_at'>;
  processor: { name: string; sigungu: string | null };
  chip_label: string;
  weight_kg_per_month: number;
  phone_masked: string;
};

const PREFIX = 'refit:request:';
const memory = new Map<string, RequestSummary>();

function ls(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export const requestStore = {
  get(id: string): RequestSummary | null {
    try {
      const raw = ls()?.getItem(PREFIX + id);
      if (raw) return JSON.parse(raw) as RequestSummary;
    } catch {
      /* 메모리로 */
    }
    return memory.get(id) ?? null;
  },
  set(s: RequestSummary) {
    memory.set(s.request.id, s);
    try {
      ls()?.setItem(PREFIX + s.request.id, JSON.stringify(s));
    } catch {
      /* 메모리에만 */
    }
  },
  setStatus(id: string, status: RequestSummary['request']['status']) {
    const s = requestStore.get(id);
    if (s) requestStore.set({ ...s, request: { ...s.request, status } });
  },
};
