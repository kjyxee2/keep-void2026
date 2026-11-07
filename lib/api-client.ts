// 브라우저와 서버 컴포넌트에서 쓰는 API 호출 함수. 계약: docs/api.md
// 비회원 토큰(anon_token)은 진단 id별로 localStorage에 저장하고, 접근이 막히면 메모리에 둔다.
// 오류 응답 { error }는 ApiError로 바꿔 던진다.
import type {
  CancelRequestResponse,
  ChipsResponse,
  ConnectionRequest,
  CreateDiagnosisResponse,
  CreateRequestBody,
  DashboardResponse,
  DiagnosisPatch,
  DiagnosisResult,
  DiagnosisRow,
  FactorySearchResponse,
  GroupResponse,
  HomeStatsResponse,
  MapLayer,
  MapResponseByLayer,
} from './types';

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
  /** 네트워크가 끊겨 응답 자체가 없음(status 0) */
  get isNetwork() {
    return this.status === 0;
  }
}

// ---------- 토큰 저장 ----------

const TOKEN_PREFIX = 'refit:anon_token:';
const memory = new Map<string, string>();

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function storage(): StorageLike | null {
  try {
    const s = (globalThis as { localStorage?: StorageLike }).localStorage;
    if (!s) return null;
    // 사파리 사생활 보호 모드처럼 쓰기가 막힌 경우를 미리 확인
    const probe = `${TOKEN_PREFIX}__probe`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export const tokenStore = {
  get(diagnosisId: string): string | null {
    const s = storage();
    if (s) {
      try {
        const v = s.getItem(TOKEN_PREFIX + diagnosisId);
        if (v) return v;
      } catch {
        /* 메모리로 */
      }
    }
    return memory.get(diagnosisId) ?? null;
  },
  set(diagnosisId: string, token: string) {
    memory.set(diagnosisId, token);
    const s = storage();
    if (!s) return;
    try {
      s.setItem(TOKEN_PREFIX + diagnosisId, token);
    } catch {
      /* 용량 초과 등: 메모리에만 */
    }
  },
  remove(diagnosisId: string) {
    memory.delete(diagnosisId);
    try {
      storage()?.removeItem(TOKEN_PREFIX + diagnosisId);
    } catch {
      /* 무시 */
    }
  },
  /** 테스트용 */
  _clearMemory() {
    memory.clear();
  },
};

// ---------- 요청 ----------

type Options = {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  /** 이 진단의 anon_token을 x-anon-token 헤더로 보냄 */
  diagnosisId?: string;
  signal?: AbortSignal;
};

/** 서버 컴포넌트에서 쓸 때는 절대 주소가 필요하다(NEXT_PUBLIC_SITE_URL 또는 VERCEL_URL) */
function baseUrl() {
  if (typeof window !== 'undefined') return '';
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return site.replace(/\/$/, '');
}

export async function request<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.diagnosisId) {
    const t = tokenStore.get(opts.diagnosisId);
    if (t) headers['x-anon-token'] = t;
  }

  let res: Response;
  try {
    res = await fetch(baseUrl() + path, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
      cache: 'no-store',
    });
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') throw e;
    throw new ApiError(0, '연결이 끊겼어요. 다시 시도해 주세요');
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string' ? (data as { error: string }).error : `요청 실패 (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

const enc = encodeURIComponent;

// ---------- 엔드포인트 ----------

export const getChips = (signal?: AbortSignal) => request<ChipsResponse>('/api/chips', { signal });

export const searchFactories = (q: string, signal?: AbortSignal) =>
  request<FactorySearchResponse>(`/api/factories/search?q=${enc(q)}`, { signal });

/** 진단을 만들고 anon_token을 저장한다(토큰은 이때 한 번만 내려옴) */
export async function createDiagnosis(chipId: string) {
  const res = await request<CreateDiagnosisResponse>('/api/diagnoses', { method: 'POST', body: { chip_id: chipId } });
  tokenStore.set(res.id, res.anon_token);
  return res;
}

export const patchDiagnosis = (id: string, patch: DiagnosisPatch) =>
  request<DiagnosisRow>(`/api/diagnoses/${enc(id)}`, { method: 'PATCH', body: patch, diagnosisId: id });

export const completeDiagnosis = (id: string) =>
  request<DiagnosisResult>(`/api/diagnoses/${enc(id)}/complete`, { method: 'POST', diagnosisId: id });

/** 토큰이 있으면 전체 응답, 없으면 공유 보기(위치와 처리비 빠짐) */
export const getDiagnosis = (id: string, signal?: AbortSignal) =>
  request<DiagnosisResult>(`/api/diagnoses/${enc(id)}`, { diagnosisId: id, signal });

export const createRequest = (body: CreateRequestBody) =>
  request<ConnectionRequest>('/api/requests', { method: 'POST', body, diagnosisId: body.diagnosis_id });

/** 요청 취소. 요청을 만든 진단의 토큰이 필요하다 */
export const cancelRequest = (requestId: string, diagnosisId: string) =>
  request<CancelRequestResponse>(`/api/requests/${enc(requestId)}/cancel`, { method: 'POST', diagnosisId });

export function getMap<L extends MapLayer>(layer: L, group?: string, signal?: AbortSignal) {
  const q = `layer=${layer}${group ? `&group=${enc(group)}` : ''}`;
  return request<MapResponseByLayer[L]>(`/api/map?${q}`, { signal });
}

export const getDashboard = (signal?: AbortSignal) => request<DashboardResponse>('/api/dashboard', { signal });

/** 백엔드 P0 브랜치에서 추가: GET /api/home-stats */
export const getHomeStats = (signal?: AbortSignal) => request<HomeStatsResponse>('/api/home-stats', { signal });

/** 백엔드 P0 브랜치에서 추가: GET /api/groups?factory_id= 또는 ?diagnosis_id= */
export function getGroup(by: { factory_id: string } | { diagnosis_id: string }, signal?: AbortSignal) {
  const q = 'factory_id' in by ? `factory_id=${enc(by.factory_id)}` : `diagnosis_id=${enc(by.diagnosis_id)}`;
  return request<GroupResponse>(`/api/groups?${q}`, { signal, diagnosisId: 'diagnosis_id' in by ? by.diagnosis_id : undefined });
}
