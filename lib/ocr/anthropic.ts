// Anthropic(Claude) OCR 공급자. 서버 전용: ANTHROPIC_API_KEY는 이 파일을 쓰는 Route Handler에서만 읽는다.
import Anthropic from '@anthropic-ai/sdk';
import { OCR_INSTRUCTIONS, OCR_SCHEMA } from './schema.ts';
import { OcrModelError, type OcrInput, type OcrProvider, type OcrRaw } from './provider.ts';

export const OCR_TIMEOUT_MS = 20_000;

// 테스트에서 가짜 클라이언트를 넣을 수 있게 messages.create만 요구
type CallOptions = { signal?: AbortSignal; timeout?: number; maxRetries?: number };
export type MessagesClient = {
  messages: { create(params: Anthropic.MessageCreateParamsNonStreaming, options?: CallOptions): PromiseLike<Anthropic.Message> };
};

export async function extractWithClaude(client: MessagesClient, input: OcrInput & { model: string }): Promise<OcrRaw> {
  const res = await client.messages.create({
    model: input.model,
    // 적응형 사고가 기본으로 켜져 있어 사고 토큰도 이 한도에 들어간다. JSON 결과는 수백 토큰
    max_tokens: 4096,
    system: OCR_INSTRUCTIONS,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: OCR_SCHEMA } },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: input.mime, data: Buffer.from(input.bytes).toString('base64') } },
        { type: 'text', text: '이 서류 사진에서 규칙대로 값을 옮겨 적어 주세요.' },
      ],
    }],
  }, { signal: input.signal, timeout: OCR_TIMEOUT_MS, maxRetries: 0 });

  if (res.stop_reason === 'refusal') throw new OcrModelError('refusal');
  if (res.stop_reason === 'max_tokens') throw new OcrModelError('truncated');
  const block = res.content.find(b => b.type === 'text');
  if (!block || block.type !== 'text') throw new OcrModelError('empty');
  let raw: unknown;
  try { raw = JSON.parse(block.text); } catch { throw new OcrModelError('invalid_json'); }
  const u = res.usage;
  return { raw, usage: u ? { input_tokens: u.input_tokens, output_tokens: u.output_tokens } : null };
}

export function anthropicProvider(apiKey: string, model: string): OcrProvider {
  const client = new Anthropic({ apiKey, timeout: OCR_TIMEOUT_MS, maxRetries: 0 });
  return { name: 'anthropic', model, extract: input => extractWithClaude(client, { ...input, model }) };
}
