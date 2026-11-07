// OCR 공급자 공통 인터페이스. 공급자는 이미지 바이트를 받아 schema.ts 모양의 JSON(검사 전)만 돌려준다.
// 검사, 단위 환산, 이름 연결, null 처리는 normalize.ts, mapping.ts에서 공급자와 상관없이 같은 규칙으로 한다.
// 서버 전용. 클라이언트 컴포넌트에서 import 금지(키를 다룸).

import type { ImageMime } from './validate.ts';

export type OcrUsage = { input_tokens: number; output_tokens: number };
export type OcrInput = { bytes: Uint8Array; mime: ImageMime; signal?: AbortSignal };
export type OcrRaw = { raw: unknown; usage: OcrUsage | null };

export interface OcrProvider {
  name: string;
  model: string;
  extract(input: OcrInput): Promise<OcrRaw>;
}

// 모델이 거절했거나 결과가 잘렸거나 JSON이 아닐 때
export class OcrModelError extends Error {
  reason: 'refusal' | 'truncated' | 'invalid_json' | 'empty';
  constructor(reason: OcrModelError['reason']) {
    super(`ocr model output: ${reason}`);
    this.reason = reason;
  }
}

export const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-5-5';

type Env = Record<string, string | undefined>;
export type ProviderChoice =
  | { ok: true; provider: { name: 'anthropic'; model: string; apiKey: string } }
  | { ok: false; reason: 'missing_key' | 'unknown_provider' };

// OCR_PROVIDER(기본 anthropic). 지금은 anthropic 하나만 구현되어 있다
export function selectProvider(env: Env): ProviderChoice {
  const name = (env.OCR_PROVIDER?.trim() || 'anthropic').toLowerCase();
  if (name !== 'anthropic') return { ok: false, reason: 'unknown_provider' };
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return { ok: false, reason: 'missing_key' };
  return { ok: true, provider: { name, model: env.ANTHROPIC_OCR_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL, apiKey } };
}
