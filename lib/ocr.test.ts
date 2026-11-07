// 서류 사진 자동 입력(OCR) 단위 테스트. 실행: npm run test:api
// Anthropic 클라이언트는 가짜 객체로 대신한다(네트워크 호출 없음).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkImage, MAX_IMAGE_BYTES, sniffImage } from './ocr/validate.ts';
import { normalizeExtraction, unitFactor } from './ocr/normalize.ts';
import { buildChipIndex, buildProcessorIndex, matchChip, matchProcessor, normKey } from './ocr/mapping.ts';
import { createLimiter } from './ocr/ratelimit.ts';
import { OCR_SCHEMA } from './ocr/schema.ts';
import { extractWithClaude, type MessagesClient } from './ocr/anthropic.ts';
import { OcrModelError, selectProvider } from './ocr/provider.ts';

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
const ascii = (s: string) => [...s].map(c => c.charCodeAt(0));
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP = bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP'));
const HEIC = bytes(0, 0, 0, 0x18, ...ascii('ftypheic'));

// ── 1. 파일 검사: 확장자, Content-Type이 아니라 앞부분 바이트로 판단 ──
test('magic bytes identify jpeg, png, webp, heic', () => {
  assert.equal(sniffImage(JPEG), 'image/jpeg');
  assert.equal(sniffImage(PNG), 'image/png');
  assert.equal(sniffImage(WEBP), 'image/webp');
  assert.equal(sniffImage(HEIC), 'image/heic');
  assert.equal(sniffImage(bytes(0, 0, 0, 0x18, ...ascii('ftypmif1'))), 'image/heic');
  assert.equal(sniffImage(bytes(...ascii('GIF89a'))), null);           // GIF는 받지 않음
  assert.equal(sniffImage(bytes(...ascii('%PDF-1.7'))), null);
  assert.equal(sniffImage(bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WAVE'))), null);
  assert.equal(sniffImage(new Uint8Array([0xff, 0xd8])), null);       // 너무 짧음
});

test('checkImage rejects empty, oversized, heic, unknown with Korean messages', () => {
  assert.deepEqual(checkImage(JPEG), { ok: true, mime: 'image/jpeg' });
  const empty = checkImage(new Uint8Array());
  assert.equal(empty.ok, false);
  assert.equal(!empty.ok && empty.status, 400);
  const big = new Uint8Array(MAX_IMAGE_BYTES + 1); big.set([0xff, 0xd8, 0xff]);
  const r = checkImage(big);
  assert.equal(!r.ok && r.status, 413);
  const h = checkImage(HEIC);
  assert.equal(!h.ok && h.status, 415);
  assert.match(!h.ok ? h.error : '', /HEIC/);
  const u = checkImage(bytes(...ascii('%PDF-1.7')));
  assert.equal(!u.ok && u.status, 415);
});

test('size cap keeps base64 under the 10 MB API image limit', () => {
  assert.ok(Math.ceil(MAX_IMAGE_BYTES / 3) * 4 <= 10 * 1024 * 1024);
});

// ── 2. 모델 출력 정리: 서류에 적힌 값만, 톤은 단위가 적혀 있을 때만 kg로 ──
const raw = (over: Record<string, unknown> = {}) => ({
  document_type: '계량표',
  weight_value: 12.34, weight_unit_raw: '톤',
  waste_type_raw: '폐합성수지류', processor_name_raw: '(주)비노텍', transporter_name_raw: '(주)동우',
  date_raw: '2026.10.02',
  confidence: { weight: 0.95, waste_type: 0.9, processor_name: 0.8 },
  evidence: { weight: '실중량 12.34 톤', waste_type: '품명: 폐합성수지류', processor_name: '처리자 (주)비노텍',
              transporter_name: '운반자 (주)동우', date: '2026.10.02' },
  ...over,
});

test('unit factor: only kg or ton spellings count', () => {
  for (const u of ['kg', 'KG', 'Kg', '㎏', '킬로그램', ' kg ']) assert.equal(unitFactor(u), 1, u);
  for (const u of ['t', 'T', '톤', 'ton', 'TON', 'tons', '㎳']) assert.equal(unitFactor(u), u === '㎳' ? null : 1000, u);
  for (const u of [null, '', 'g', '㎥', 'L', '마대', '대', 'kg/일']) assert.equal(unitFactor(u as string | null), null, String(u));
});

test('tons convert to kg only when the unit is printed', () => {
  assert.equal(normalizeExtraction(raw()).weight_kg, 12340);
  assert.equal(normalizeExtraction(raw({ weight_value: 2480, weight_unit_raw: 'kg', evidence: { ...raw().evidence, weight: '2,480 kg' } })).weight_kg, 2480);
  const noUnit = normalizeExtraction(raw({ weight_unit_raw: null, evidence: { ...raw().evidence, weight: '12.34' } }));
  assert.equal(noUnit.weight_kg, null);                     // 단위가 없으면 추정하지 않음
  assert.equal(noUnit.weight_unit_raw, null);
  const m3 = normalizeExtraction(raw({ weight_unit_raw: '㎥', evidence: { ...raw().evidence, weight: '12.34 ㎥' } }));
  assert.equal(m3.weight_kg, null);
  assert.equal(m3.weight_unit_raw, '㎥');                   // 원문은 남김
});

test('weight is dropped when the evidence does not show the number', () => {
  const r = normalizeExtraction(raw({ evidence: { ...raw().evidence, weight: '실중량 12.43 톤' } }));
  assert.equal(r.weight_kg, null);
  const none = normalizeExtraction(raw({ evidence: { ...raw().evidence, weight: null } }));
  assert.equal(none.weight_kg, null);
});

test('bad or missing model fields become null, never guessed', () => {
  const r = normalizeExtraction({ document_type: '영수증', weight_value: -5, weight_unit_raw: 'kg',
    waste_type_raw: '   ', processor_name_raw: 7, confidence: { weight: 3 }, evidence: {} });
  assert.equal(r.document_type, '판독불가');
  assert.equal(r.weight_kg, null);
  assert.equal(r.waste_type_raw, null);
  assert.equal(r.processor_name_raw, null);
  assert.equal(r.date_raw, null);
  assert.deepEqual(r.confidence, { weight_kg: 0, waste_type_raw: 0, processor_name_raw: 0 });
  assert.equal(normalizeExtraction(null).document_type, '판독불가');
  assert.equal(normalizeExtraction('nope').weight_kg, null);
});

test('unreadable document returns all nulls', () => {
  const r = normalizeExtraction(raw({ document_type: '판독불가' }));
  assert.equal(r.weight_kg, null);
  assert.equal(r.waste_type_raw, null);
  assert.equal(r.evidence.weight_kg, null);
});

test('response keeps spec field names and clamps confidence', () => {
  const r = normalizeExtraction(raw({ confidence: { weight: 1.4, waste_type: -1, processor_name: 0.5 } }));
  assert.deepEqual(Object.keys(r).sort(), ['confidence', 'date_raw', 'document_type', 'evidence', 'processor_name_raw',
    'transporter_name_raw', 'waste_type_raw', 'weight_kg', 'weight_unit_raw']);
  assert.deepEqual(r.confidence, { weight_kg: 1, waste_type_raw: 0, processor_name_raw: 0.5 });
  assert.equal(r.evidence.processor_name_raw, '처리자 (주)비노텍');
  assert.equal(r.evidence.transporter_name_raw, '운반자 (주)동우');
});

test('long strings are capped', () => {
  const r = normalizeExtraction(raw({ waste_type_raw: '가'.repeat(500) }));
  assert.equal(r.waste_type_raw!.length, 200);
});

// ── 3. 이름 연결: 정확히 같거나 정규화 후 같을 때만, 겹치면 null ──
const chips = [
  { id: 'C01', label: '폐합성수지', waste_group: '폐합성수지류' },
  { id: 'C04', label: '폐유', waste_group: '폐유' },
  { id: 'C16', label: '폐산, 폐알칼리', waste_group: '폐산,폐알칼리' },
];
const wasteTypes = [
  { waste_type: '폐합성수지류(폐염화비닐수지류는 제외한다)', waste_group: '폐합성수지류' },
  { waste_type: '폐유(기름성분을 5퍼센트 이상 함유한 것)', waste_group: '폐유' },
  { waste_type: '폐산(액체상태의 것으로서 수소이온 농도지수가 2.0 이하인 것으로 한정한다)', waste_group: '폐산,폐알칼리' },
  { waste_type: '그 밖의 폐기물', waste_group: '그 밖의 폐기물' },     // 칩 없음
];

test('normKey removes spacing and punctuation, keeps letters', () => {
  assert.equal(normKey(' 폐산, 폐알칼리 '), '폐산폐알칼리');
  assert.equal(normKey('㈜비노텍'), normKey('(주)비노텍'));
  assert.notEqual(normKey('폐유'), normKey('폐유기용제'));
});

test('waste type maps to chip by label, group or reported waste_type only', () => {
  const idx = buildChipIndex(chips, wasteTypes);
  assert.equal(matchChip(idx, '폐합성수지'), 'C01');
  assert.equal(matchChip(idx, '폐합성수지류'), 'C01');
  assert.equal(matchChip(idx, '폐합성수지류 (폐염화비닐수지류는 제외한다)'), 'C01');
  assert.equal(matchChip(idx, '폐산 폐알칼리'), 'C16');
  assert.equal(matchChip(idx, '폐유'), 'C04');
  assert.equal(matchChip(idx, '폐유기용제'), null);          // 비슷해도 다르면 연결 안 함
  assert.equal(matchChip(idx, '합성수지'), null);             // 부분 일치 없음
  assert.equal(matchChip(idx, '그 밖의 폐기물'), null);       // 칩 없는 군
  assert.equal(matchChip(idx, null), null);
});

test('waste key claimed by two chips is ambiguous', () => {
  const idx = buildChipIndex([...chips, { id: 'C99', label: '폐유', waste_group: '기타' }], []);
  assert.equal(matchChip(idx, '폐유'), null);
});

const procs = [
  { id: 'P0002', name: '비노텍(주)', name_variants: ['(주)비노텍', '비노텍', '비노텍(주)', '비노텍㈜'] },
  { id: 'P0001', name: '코어엔텍 주식회사', name_variants: ['코어엔텍(주)', 'KG이티에스(주)'] },
  { id: 'P0100', name: '한빛(주)', name_variants: null },
  { id: 'P0101', name: '한빛 주식회사', name_variants: null },
];

test('processor maps by exact normalized name or name_variants', () => {
  const idx = buildProcessorIndex(procs);
  assert.deepEqual(matchProcessor(idx, '(주)비노텍'), { id: 'P0002', name: '비노텍(주)' });
  assert.deepEqual(matchProcessor(idx, '비노텍 ㈜'), { id: 'P0002', name: '비노텍(주)' });
  assert.deepEqual(matchProcessor(idx, '주식회사 비노텍'), { id: 'P0002', name: '비노텍(주)' });
  assert.deepEqual(matchProcessor(idx, 'kg이티에스(주)'), { id: 'P0001', name: '코어엔텍 주식회사' });
  assert.equal(matchProcessor(idx, '비노텍산업'), null);      // 퍼지 매칭 없음
  assert.equal(matchProcessor(idx, '노텍'), null);
  assert.equal(matchProcessor(idx, '한빛(주)'), null);        // 두 업체가 같은 키 → 모름
  assert.equal(matchProcessor(idx, ''), null);
});

// ── 4. 요청 제한 ──
test('token bucket limits per key and refills over time', () => {
  let t = 0;
  const lim = createLimiter({ capacity: 2, refillPerSec: 0.5, now: () => t });
  assert.equal(lim.take('a').ok, true);
  assert.equal(lim.take('a').ok, true);
  const third = lim.take('a');
  assert.equal(third.ok, false);
  assert.equal(third.retryAfterSec, 2);
  assert.equal(lim.take('b').ok, true);                       // 다른 IP는 따로
  t = 2000;
  assert.equal(lim.take('a').ok, true);
});

// ── 5. 모델 호출(가짜 클라이언트) ──
type Params = Parameters<MessagesClient['messages']['create']>[0];
const fake = (reply: Record<string, unknown>) => {
  const calls: Params[] = [];
  const client: MessagesClient = { messages: { create: async (p: Params) => { calls.push(p); return reply as never; } } };
  return { client, calls };
};

test('extractWithClaude sends image with strict JSON schema and parses result', async () => {
  const { client, calls } = fake({ stop_reason: 'end_turn', content: [
    { type: 'thinking', thinking: '', signature: 'x' },
    { type: 'text', text: JSON.stringify(raw()) }],
    usage: { input_tokens: 1500, output_tokens: 300 } });
  const out = await extractWithClaude(client, { bytes: JPEG, mime: 'image/jpeg', model: 'claude-haiku-5-5' });
  assert.equal(out.raw && (out.raw as { weight_value: number }).weight_value, 12.34);
  assert.deepEqual(out.usage, { input_tokens: 1500, output_tokens: 300 });
  const p = calls[0];
  assert.equal(p.model, 'claude-haiku-5-5');
  assert.equal(p.output_config?.format?.type, 'json_schema');
  assert.equal(p.output_config?.format?.schema, OCR_SCHEMA);
  const content = p.messages[0].content as { type: string; source?: { media_type: string; data: string } }[];
  assert.equal(content[0].type, 'image');
  assert.equal(content[0].source!.media_type, 'image/jpeg');
  assert.equal(content[0].source!.data, Buffer.from(JPEG).toString('base64'));
  assert.equal('temperature' in p, false);                    // Haiku 5.5는 샘플링 값을 받지 않음
});

test('extractWithClaude raises on refusal, truncation, or broken JSON', async () => {
  for (const reply of [
    { stop_reason: 'refusal', content: [] },
    { stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"document_type":' }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] },
    { stop_reason: 'end_turn', content: [] },
  ]) {
    const { client } = fake(reply);
    await assert.rejects(extractWithClaude(client, { bytes: JPEG, mime: 'image/jpeg', model: 'm' }), OcrModelError);
  }
});

test('schema is strict and stays under the union-type limit', () => {
  const s = JSON.stringify(OCR_SCHEMA);
  assert.equal(OCR_SCHEMA.additionalProperties, false);
  const unions = (s.match(/"type":\["(string|number)","null"\]/g) ?? []).length;
  assert.ok(unions <= 16, `union types ${unions}`);
  assert.doesNotMatch(s, /minimum|maximum/);
});

// ── 6. 공급자 선택: OCR_PROVIDER(기본 anthropic). 후처리는 공급자 밖 공통 코드 ──
test('provider defaults to anthropic and needs its key', () => {
  const p = selectProvider({ ANTHROPIC_API_KEY: 'k' });
  assert.equal(p.ok && p.provider.name, 'anthropic');
  assert.equal(p.ok && p.provider.model, 'claude-haiku-5-5');
  const custom = selectProvider({ OCR_PROVIDER: 'Anthropic', ANTHROPIC_API_KEY: 'k', ANTHROPIC_OCR_MODEL: 'claude-sonnet-5-5' });
  assert.equal(custom.ok && custom.provider.model, 'claude-sonnet-5-5');
  const noKey = selectProvider({ ANTHROPIC_API_KEY: '  ' });
  assert.deepEqual(noKey, { ok: false, reason: 'missing_key' });
  const unknown = selectProvider({ OCR_PROVIDER: 'other', ANTHROPIC_API_KEY: 'k' });
  assert.deepEqual(unknown, { ok: false, reason: 'unknown_provider' });
});
