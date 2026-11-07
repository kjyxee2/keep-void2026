// 이 브라우저의 마지막 완료 진단을 찾는다(브라우저 전용).
// 1) 진단을 마칠 때 적어 둔 id(refit:last_completed_diagnosis)를 먼저 GET /api/diagnoses/:id 로 확인한다.
// 2) 없거나 못 읽으면 토큰 키(refit:anon_token:<id>)의 id들을 모두 확인하고 완료 시각이 가장 늦은 것을 고른다.
//    아직 끝나지 않은 진단은 404라서 빠진다.
import { ApiError, getDiagnosis } from './api-client';
import { diagnosisIdsFromKeys, LAST_COMPLETED_KEY, pickLatest } from './report-data';
import type { DiagnosisResult } from './types';

/** 진단을 마친 직후 적어 둔다. 저장이 막혀 있으면 조용히 넘어간다 */
export function rememberLastCompleted(id: string) {
  try {
    globalThis.localStorage?.setItem(LAST_COMPLETED_KEY, id);
  } catch {
    /* 저장이 막힌 브라우저 */
  }
}

export function lastCompletedId(): string | null {
  try {
    return globalThis.localStorage?.getItem(LAST_COMPLETED_KEY) ?? null;
  } catch {
    return null;
  }
}

function storedKeys(): string[] {
  try {
    const s = globalThis.localStorage;
    if (!s) return [];
    return Array.from({ length: s.length }, (_, i) => s.key(i)).filter((k): k is string => typeof k === 'string');
  } catch {
    return [];
  }
}

/** 없으면 null. 확인한 진단이 모두 연결 오류로 실패하면 ApiError를 던진다 */
export async function loadLatestDiagnosis(signal?: AbortSignal): Promise<DiagnosisResult | null> {
  const remembered = lastCompletedId();
  if (remembered && diagnosisIdsFromKeys([`refit:anon_token:${remembered}`]).length) {
    try {
      const d = await getDiagnosis(remembered, signal);
      if (d?.completed_at) return d;
    } catch (e) {
      // 지워졌거나(404) 남의 것(403)이면 토큰 목록으로 넘어간다. 연결 오류도 목록 확인에서 다시 판단
      if (!(e instanceof ApiError)) throw e;
    }
  }
  const ids = diagnosisIdsFromKeys(storedKeys());
  if (!ids.length) return null;
  let failed = 0;
  let lastError: ApiError | null = null;
  const results = await Promise.all(
    ids.map((id) =>
      getDiagnosis(id, signal).catch((e: unknown) => {
        if (e instanceof ApiError && (e.isNetwork || e.status >= 500)) {
          failed += 1;
          lastError = e;
        } else if (!(e instanceof ApiError)) throw e;
        return null;
      }),
    ),
  );
  const latest = pickLatest(results);
  if (!latest && failed === ids.length && lastError) throw lastError;
  return latest;
}
