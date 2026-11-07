// 이 브라우저의 마지막 완료 진단을 찾는다(브라우저 전용).
// 진단 흐름은 토큰을 진단 id별로 localStorage(refit:anon_token:<id>)에 둔다. 그 id들을 GET /api/diagnoses/:id 로 확인하고
// 완료 시각이 가장 늦은 것을 고른다. 아직 끝나지 않은 진단은 404라서 빠진다.
import { ApiError, getDiagnosis } from './api-client';
import { diagnosisIdsFromKeys, pickLatest } from './report-data';
import type { DiagnosisResult } from './types';

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
