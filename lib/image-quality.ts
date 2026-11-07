// 서류 사진 선명도 사전 검사. 브라우저에서 서버로 보내기 전에 흔들린 사진을 거른다.
// 순수 함수: ImageData와 같은 모양({ width, height, data: RGBA })만 받는다. DOM, canvas에 의존하지 않는다.
// 방법: 긴 변 MAX_SIDE 이하로 면적 평균 축소 → 회색조 → 밝기 범위를 2~98백분위로 늘림(어두운 사진을 흐림으로 보지 않게)
//       → 4방향 라플라시안의 분산. 값이 작을수록 흐리다.
// 기준값은 시험용 견본 사진 70장(흐림 변형 6장 vs 나머지 64장)으로 정했다(research/ai/ocr_eval/README.md).

export type ImageDataLike = { width: number; height: number; data: Uint8ClampedArray | Uint8Array };
export type QualityReason = 'blurry' | 'too_small';
export type QualityResult = { ok: boolean; score: number; reason: QualityReason | null };

export const MAX_SIDE = 1024;
export const MIN_SIDE = 400;          // 긴 변이 이보다 작으면 글자를 읽기 어렵다
export const BLUR_THRESHOLD = 350;   // 흐림 6장 최대 250.3, 나머지 64장 최소 480.5(H4_shadow) 사이

export const QUALITY_MESSAGES: Record<QualityReason, string> = {
  blurry: '사진이 흔들렸어요. 서류를 정면에서, 화면에 꽉 차게 다시 찍어 주세요.',
  too_small: '사진이 너무 작아요. 서류가 화면에 꽉 차게 다시 찍어 주세요.',
};

// 면적 평균으로 줄인 회색조(0~255, Float32)
function grayDownscaled(img: ImageDataLike): { w: number; h: number; g: Float32Array } {
  const { width: W, height: H, data } = img;
  const s = Math.max(1, Math.max(W, H) / MAX_SIDE);
  const w = Math.max(1, Math.floor(W / s)), h = Math.max(1, Math.floor(H / s));
  const sum = new Float64Array(w * h), cnt = new Uint32Array(w * h);
  for (let y = 0; y < H; y++) {
    const ty = Math.min(h - 1, Math.floor(y / s));
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, t = ty * w + Math.min(w - 1, Math.floor(x / s));
      sum[t] += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      cnt[t]++;
    }
  }
  const g = new Float32Array(w * h);
  for (let i = 0; i < g.length; i++) g[i] = cnt[i] ? sum[i] / cnt[i] : 0;
  return { w, h, g };
}

// 2~98백분위를 0~255로 늘린다. 범위가 거의 없으면(빈 화면) 그대로
function stretch(g: Float32Array) {
  const hist = new Uint32Array(256);
  for (const v of g) hist[Math.min(255, Math.max(0, Math.round(v)))]++;
  const pick = (q: number) => {
    let acc = 0;
    for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= q * g.length) return i; }
    return 255;
  };
  const lo = pick(0.02), hi = pick(0.98);
  if (hi - lo < 8) return;
  const k = 255 / (hi - lo);
  for (let i = 0; i < g.length; i++) g[i] = Math.min(255, Math.max(0, (g[i] - lo) * k));
}

export function sharpnessScore(img: ImageDataLike): number {
  const { w, h, g } = grayDownscaled(img);
  if (w < 3 || h < 3) return 0;
  stretch(g);
  let n = 0, mean = 0, m2 = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i];
      n++;
      const d = lap - mean;
      mean += d / n;
      m2 += d * (lap - mean);
    }
  }
  return n ? Math.round((m2 / n) * 10) / 10 : 0;
}

export function checkImageQuality(img: ImageDataLike, opts: { threshold?: number } = {}): QualityResult {
  const threshold = opts.threshold ?? BLUR_THRESHOLD;
  if (Math.max(img.width, img.height) < MIN_SIDE) return { ok: false, score: 0, reason: 'too_small' };
  const score = sharpnessScore(img);
  return score >= threshold ? { ok: true, score, reason: null } : { ok: false, score, reason: 'blurry' };
}
