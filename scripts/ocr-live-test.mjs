// 서류 사진 자동 입력 실시간 시험(선택). 실제 Claude API를 호출하므로 요금이 든다(견본 2장, 장당 약 0.1원 수준).
// 실행: node scripts/ocr-live-test.mjs   (ANTHROPIC_API_KEY가 없으면 건너뜀)
// 시험용 견본(tests/fixtures/sample-*.png)만 보낸다. 실제 서류를 넣지 말 것. 키 값은 출력하지 않는다.
import { readFileSync, existsSync } from 'node:fs';
import { anthropicProvider } from '../lib/ocr/anthropic.ts';
import { normalizeExtraction } from '../lib/ocr/normalize.ts';
import { selectProvider } from '../lib/ocr/provider.ts';
import { checkImage } from '../lib/ocr/validate.ts';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const choice = selectProvider(process.env);
if (!choice.ok) {
  console.log(`건너뜀: ${choice.reason === 'missing_key' ? 'ANTHROPIC_API_KEY가 비어 있음(.env.local에 넣으면 실행됨)' : 'OCR_PROVIDER가 anthropic이 아님'}`);
  process.exit(0);
}

// claude-api 스킬 요금표(2026-10-06 기준, 1M 토큰당 달러). Haiku 5.5는 프롬프트 100K 토큰 이하 요금
const PRICE = {
  'claude-haiku-5-5': [0.10, 0.50], 'claude-haiku-4-5': [1, 5], 'claude-sonnet-5-5': [2, 10],
  'claude-sonnet-5': [2, 10], 'claude-opus-5-5': [4, 20], 'claude-fable-5-1': [10, 50],
};
const KRW_PER_USD = Number(process.env.KRW_PER_USD || 1400);   // 원화 환산은 참고용 가정 환율

const cases = [
  { file: 'tests/fixtures/sample-weighbridge.png', expect: { document_type: '계량표', weight_kg: 12340, waste_type_raw: '폐합성수지류',
      processor_name_raw: '견본리사이클(주)', transporter_name_raw: '견본운수(주)' } },
  { file: 'tests/fixtures/sample-handover.png', expect: { document_type: '인계서', weight_kg: 2480, waste_type_raw: '폐유',
      processor_name_raw: '견본리사이클(주)', transporter_name_raw: '견본운수(주)' } },
];

const { model, apiKey } = choice.provider;
const provider = anthropicProvider(apiKey, model);
console.log(`모델 ${model}`);
let failed = 0;
for (const c of cases) {
  const bytes = new Uint8Array(readFileSync(c.file));
  const check = checkImage(bytes);
  if (!check.ok) { console.log(c.file, check.error); failed++; continue; }
  const t0 = performance.now();
  const { raw, usage } = await provider.extract({ bytes, mime: check.mime, signal: AbortSignal.timeout(20_000) });
  const ms = Math.round(performance.now() - t0);
  const r = normalizeExtraction(raw);
  const price = PRICE[model];
  const usd = price && usage ? (usage.input_tokens * price[0] + usage.output_tokens * price[1]) / 1e6 : null;
  const mismatches = Object.entries(c.expect).filter(([k, v]) => r[k] !== v);
  failed += mismatches.length ? 1 : 0;
  console.log(JSON.stringify({
    file: c.file, ok: mismatches.length === 0, mismatches: mismatches.map(([k, v]) => ({ field: k, expected: v, got: r[k] })),
    ms, usage, usd: usd && Number(usd.toFixed(6)), krw: usd && Number((usd * KRW_PER_USD).toFixed(2)), result: r,
  }, null, 2));
}
process.exit(failed ? 1 : 0);
