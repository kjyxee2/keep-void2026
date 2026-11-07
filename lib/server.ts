// Route Handler 전용. 서비스 키(RLS 우회)를 쓰므로 클라이언트 컴포넌트에서 import 금지.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// ponytail: 데모 데이터를 교체할 때 함께 갱신(data/refit_demo_data.zip 커밋)
export const DATA_VERSION = 'demo-4d8c270';

export const LABELS = {
  route: '신고 건수 집계(톤수 아님). 칩의 신고 원 표기 기준(홈 칩 통계와 같음). 신고 계약 기준이며 실제 운반량이 아님',
  neighbors: '같은 칩(신고 원 표기)을 신고한 안산 공장 수. 본인 공장 포함(홈 칩 통계와 같은 기준), 신고 건수 기준',
  candidates: '신고 경로 근거 추천, 실제 처리 가능 여부는 업체 확인 필요',
  distance: '양쪽 좌표가 건물 위치로 확인된 경우만 직선거리, 아니면 null',
  reference_prices: '원문 단가 그대로. 실제 계약가 아님, 무게와 곱하지 않음. 부가세와 운반비 별도',
} as const;

let client: SupabaseClient | null = null;
export function db() {
  client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export const json = (data: unknown, status = 200) => Response.json(data, { status });
export const fail = (status: number, error: string) => json({ error }, status);

export function dbFail(e: { message: string } | null | undefined) {
  console.error('db error:', e?.message);
  return fail(500, 'database error');
}

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export async function body(req: Request): Promise<Record<string, unknown> | null> {
  const b = await req.json().catch(() => null);
  return b && typeof b === 'object' && !Array.isArray(b) ? b : null;
}

// 비회원 토큰: 원문은 응답으로 한 번만 주고 DB에는 sha256만 저장
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
export function newAnonToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export async function userIdFrom(req: Request): Promise<string | null> {
  const jwt = req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!jwt) return null;
  const { data } = await db().auth.getUser(jwt);
  return data.user?.id ?? null;
}

// 본인 확인: x-anon-token 해시가 일치하거나 로그인 사용자가 같은 user_id
export async function isOwner(req: Request, row: { anon_token: string | null; user_id: string | null }) {
  const t = req.headers.get('x-anon-token');
  if (t && row.anon_token) {
    const a = Buffer.from(hashToken(t)), b = Buffer.from(row.anon_token);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  if (!row.user_id) return false;
  return (await userIdFrom(req)) === row.user_id;
}

export async function isOperator(req: Request) {
  const uid = await userIdFrom(req);
  if (!uid) return false;
  const { data } = await db().from('profiles').select('role').eq('id', uid).maybeSingle();
  return data?.role === 'operator';
}

// PostgREST max_rows(1000)를 넘는 조회를 나눠 받는다. build는 같은 정렬을 보장해야 함
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}
