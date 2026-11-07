// IP별 토큰 버킷. 서버 인스턴스 메모리에만 있으므로 최선 노력(best-effort) 제한이다.
// 서버리스에서는 인스턴스마다 따로 세고 재시작하면 초기화된다. 엄격한 제한이 필요하면 공유 저장소로 옮길 것.

type Bucket = { tokens: number; at: number };

export function createLimiter({ capacity, refillPerSec, now = Date.now, maxKeys = 10_000 }:
  { capacity: number; refillPerSec: number; now?: () => number; maxKeys?: number }) {
  const buckets = new Map<string, Bucket>();
  return {
    take(key: string): { ok: boolean; retryAfterSec: number } {
      const t = now();
      if (buckets.size >= maxKeys && !buckets.has(key)) buckets.clear();   // 메모리 상한
      const b = buckets.get(key) ?? { tokens: capacity, at: t };
      b.tokens = Math.min(capacity, b.tokens + ((t - b.at) / 1000) * refillPerSec);
      b.at = t;
      buckets.set(key, b);
      if (b.tokens >= 1) { b.tokens -= 1; return { ok: true, retryAfterSec: 0 }; }
      return { ok: false, retryAfterSec: Math.ceil((1 - b.tokens) / refillPerSec) };
    },
  };
}
