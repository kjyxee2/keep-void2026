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
  assert.deepEqual(r.model_confidence, { weight_kg: 0, waste_type_raw: 0, processor_name_raw: 0 });
  assert.equal(normalizeExtraction(null).document_type, '판독불가');
  assert.equal(normalizeExtraction('nope').weight_kg, null);
});

test('unreadable document returns all nulls', () => {
  const r = normalizeExtraction(raw({ document_type: '판독불가' }));
  assert.equal(r.weight_kg, null);
  assert.equal(r.waste_type_raw, null);
  assert.equal(r.evidence.weight_kg, null);
});

test('result keeps spec field names; model confidence is internal and clamped', () => {
  const r = normalizeExtraction(raw({ confidence: { weight: 1.4, waste_type: -1, processor_name: 0.5 } }));
  assert.deepEqual(Object.keys(r).sort(), ['check', 'date_raw', 'document_type', 'evidence', 'flags', 'model_confidence',
    'needs_review', 'processor_name_raw', 'transporter_name_raw', 'waste_category_raw', 'waste_type_raw', 'weight_kg',
    'weight_unit_raw', 'weight_unit_source']);
  assert.deepEqual(r.model_confidence, { weight_kg: 1, waste_type_raw: 0, processor_name_raw: 0.5 });
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
  const unions = (s.match(/"type":\["(string|number)","null"\]/g) ?? []).length + (s.match(/"anyOf"/g) ?? []).length;
  assert.ok(unions <= 16, `union types ${unions}`);
  assert.doesNotMatch(s, /minimum|maximum/);
  // API는 type 배열과 enum을 같이 쓰면 400(enum 값이 type과 맞지 않음). null 허용 enum은 anyOf로
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object') return;
    const o = n as Record<string, unknown>;
    assert.ok(!(Array.isArray(o.type) && 'enum' in o), JSON.stringify(o));
    Object.values(o).forEach(walk);
  };
  walk(OCR_SCHEMA);
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

// ── 7. 사진 선명도 사전 검사(브라우저에서 보내기 전). ImageData 모양만 쓰는 순수 함수 ──
import { checkImageQuality, sharpnessScore, BLUR_THRESHOLD } from './image-quality.ts';

const img = (w: number, h: number, f: (x: number, y: number) => number) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = f(x, y), i = (y * w + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255;
  }
  return { width: w, height: h, data };
};
// 흰 바탕에 검은 글자 획 같은 가는 세로줄
const strokes = (w: number, h: number, contrast = 1) =>
  img(w, h, (x, y) => (x % 8 < 2 && y % 40 < 30 ? 255 - Math.round(230 * contrast) : 255));
const boxBlur = (src: ReturnType<typeof img>, r: number) => {
  const { width: w, height: h } = src;
  return img(w, h, (x, y) => {
    let s = 0, n = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = Math.min(w - 1, Math.max(0, x + dx)), yy = Math.min(h - 1, Math.max(0, y + dy));
      s += src.data[(yy * w + xx) * 4]; n++;
    }
    return Math.round(s / n);
  });
};

test('sharpness: flat image scores 0, crisp strokes score higher than blurred strokes', () => {
  assert.equal(sharpnessScore(img(200, 200, () => 128)), 0);
  const sharp = sharpnessScore(strokes(320, 240));
  const blurred = sharpnessScore(boxBlur(strokes(320, 240), 3));
  assert.ok(sharp > 0);
  assert.ok(blurred < sharp / 4, `sharp ${sharp} blurred ${blurred}`);
});

test('sharpness does not depend on overall brightness or contrast (dim photo is not blur)', () => {
  const full = sharpnessScore(strokes(320, 240, 1));
  const dim = sharpnessScore(strokes(320, 240, 0.3));
  assert.ok(Math.abs(full - dim) / full < 0.15, `full ${full} dim ${dim}`);
});

test('large photos are downscaled before measuring, so the score is stable across resolution', () => {
  const small = sharpnessScore(strokes(1024, 768));
  const big = sharpnessScore(img(2048, 1536, (x, y) => (Math.floor(x / 2) % 8 < 2 && Math.floor(y / 2) % 40 < 30 ? 25 : 255)));
  assert.ok(Math.abs(small - big) / small < 0.25, `small ${small} big ${big}`);
});

test('checkImageQuality: ok above threshold, blurry below, too small rejected', () => {
  const ok = checkImageQuality(strokes(640, 480));
  assert.equal(ok.ok, true);
  assert.equal(ok.reason, null);
  assert.ok(ok.score >= BLUR_THRESHOLD);
  const bad = checkImageQuality(boxBlur(boxBlur(boxBlur(strokes(640, 480), 4), 4), 4));   // 상자 흐림 3번 ≈ 가우시안
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'blurry');
  assert.ok(bad.score < BLUR_THRESHOLD);
  const tiny = checkImageQuality(strokes(100, 80));
  assert.deepEqual([tiny.ok, tiny.reason], [false, 'too_small']);
  assert.equal(checkImageQuality(strokes(640, 480), { threshold: 1e9 }).ok, false);
});

// ── 8. 서버 검사: 항목명(라벨)으로 역할 확인, 폐기물 구분 분리, 날짜 범위, 머리글 단위, check 표시 ──
import { publicFields } from './ocr/normalize.ts';
import { roleOfLabel, parseDocDate, withChipCheck, withProcessorCheck } from './ocr/checks.ts';

const NOW = new Date('2026-11-08T03:00:00Z');   // 한국 시각 2026-11-08 12:00
const v2 = (over: Record<string, unknown> = {}, ev: Record<string, unknown> = {}) => normalizeExtraction({
  document_type: '인계서',
  weight_value: 3150, weight_unit_raw: 'kg', weight_unit_source: '숫자 옆',
  waste_type_raw: '폐합성수지류', waste_category_raw: null,
  processor_name_raw: '견본리사이클(주)', transporter_name_raw: '견본운수(주)', date_raw: '2026-10-29',
  confidence: { weight: 0.9, waste_type: 0.9, processor_name: 0.9 },
  ...over,
  evidence: { weight: '위탁량: 3,150 kg', weight_unit: '3,150 kg', waste_type: '폐기물 종류: 폐합성수지류',
    processor_name: '처리자: 견본리사이클(주)', transporter_name: '운반자: 견본운수(주)', date: '인계일자: 2026-10-29', ...ev },
}, { now: NOW });

test('labels classify role; company names inside the value do not count', () => {
  for (const l of ['처리자', '처리처', '인수업체', '반입처', '처리자 상호', '수탁처리자']) assert.equal(roleOfLabel(l), 'processor', l);
  for (const l of ['운반자', '운송', '운송사', '운반업체', '수집운반업자', '운반자 상호']) assert.equal(roleOfLabel(l), 'transporter', l);
  for (const l of ['거래처', '배출자', '배출처']) assert.equal(roleOfLabel(l), 'emitter', l);
  assert.equal(roleOfLabel('상호'), 'none');
  assert.equal(roleOfLabel('수집운반 및 처리'), 'ambiguous');
  // 값을 뺀 라벨만 본다: '한빛운송(주)'라는 처리업체 이름은 운반 라벨이 아니다
  const r = v2({ processor_name_raw: '한빛운송(주)' }, { processor_name: '처리자: 한빛운송(주)' });
  assert.equal(r.processor_name_raw, '한빛운송(주)');
  assert.equal(r.check.processor_name_raw, '확인됨');
});

test('clean labelled read: every field is 확인됨 and no review needed', () => {
  const r = v2();
  assert.deepEqual(r.check, { weight_kg: '확인됨', waste_type_raw: '확인됨', processor_name_raw: '확인됨',
    transporter_name_raw: '확인됨', date_raw: '확인됨' });
  assert.deepEqual(r.flags, []);
  assert.equal(r.needs_review, false);
});

test('processor and transporter are swapped back only when both labels are unambiguous', () => {
  const r = v2({ processor_name_raw: '견본운수(주)', transporter_name_raw: '견본리사이클(주)' },
    { processor_name: '운송: 견본운수(주)', transporter_name: '처리처: 견본리사이클(주)' });
  assert.equal(r.processor_name_raw, '견본리사이클(주)');
  assert.equal(r.transporter_name_raw, '견본운수(주)');
  assert.equal(r.evidence.processor_name_raw, '처리처: 견본리사이클(주)');
  assert.ok(r.flags.includes('role_swapped'));
  assert.equal(r.check.processor_name_raw, '확인 필요');      // 바로잡았어도 사람이 한 번 본다
  assert.equal(r.needs_review, true);
});

test('one-sided or emitter role mismatch nulls both companies with a flag', () => {
  const a = v2({ processor_name_raw: '견본운수(주)' }, { processor_name: '운반자: 견본운수(주)', transporter_name: '상호: 견본운수(주)' });
  assert.equal(a.processor_name_raw, null);
  assert.equal(a.transporter_name_raw, null);
  assert.ok(a.flags.includes('role_conflict'));
  const b = v2({ processor_name_raw: '시험공장(주)' }, { processor_name: '거래처: 시험공장(주)' });
  assert.deepEqual([b.processor_name_raw, b.transporter_name_raw], [null, null]);
  assert.ok(b.flags.includes('role_conflict'));
});

test('missing label keeps the value but asks to check; same company in both roles is flagged', () => {
  const r = v2({}, { processor_name: '견본리사이클(주)' });
  assert.equal(r.processor_name_raw, '견본리사이클(주)');
  assert.equal(r.check.processor_name_raw, '확인 필요');
  const same = v2({ transporter_name_raw: '견본리사이클(주)' }, { transporter_name: '운반자: 견본리사이클(주)' });
  assert.ok(same.flags.includes('same_company'));
  assert.equal(same.check.processor_name_raw, '확인 필요');
  assert.equal(same.check.transporter_name_raw, '확인 필요');
  // 근거에 값이 없으면 확인됨이 아니다
  assert.equal(v2({}, { processor_name: '처리자: 다른업체(주)' }).check.processor_name_raw, '확인 필요');
});

test('waste category words are kept in waste_category_raw, not as the waste type', () => {
  const r = v2({ waste_type_raw: '사업장일반폐기물' }, { waste_type: '사업장일반폐기물' });
  assert.equal(r.waste_type_raw, null);
  assert.equal(r.waste_category_raw, '사업장일반폐기물');
  assert.ok(r.flags.includes('waste_category_only'));
  const both = v2({ waste_category_raw: '지정폐기물', waste_type_raw: '폐유' }, { waste_type: '폐기물 종류: 폐유' });
  assert.deepEqual([both.waste_type_raw, both.waste_category_raw], ['폐유', '지정폐기물']);
});

test('waste type read from a non waste-type cell (구분, 성상) is rejected', () => {
  const r = v2({ waste_type_raw: '고상' }, { waste_type: '성상: 고상' });
  assert.equal(r.waste_type_raw, null);
  assert.ok(r.flags.includes('waste_label_mismatch'));
  const ok = v2({ waste_type_raw: '폐유' }, { waste_type: '품목: 폐유' });
  assert.equal(ok.check.waste_type_raw, '확인됨');
  const unlabeled = v2({ waste_type_raw: '폐유' }, { waste_type: '폐유' });
  assert.deepEqual([unlabeled.waste_type_raw, unlabeled.check.waste_type_raw], ['폐유', '확인 필요']);
});

test('dates: parsed in Korean formats; future or older than 400 days needs review', () => {
  assert.equal(parseDocDate('2026년 10월 15일'), '2026-10-15');
  assert.equal(parseDocDate('2026. 10. 23'), '2026-10-23');
  assert.equal(parseDocDate('26/10/27'), '2026-10-27');
  assert.equal(parseDocDate('2026-02-30'), null);
  assert.equal(parseDocDate('견본'), null);
  const future = v2({ date_raw: '2026-11-20' }, { date: '인계일자: 2026-11-20' });
  assert.equal(future.date_raw, '2026-11-20');                // 값은 남기고 확인을 받는다
  assert.ok(future.flags.includes('date_future'));
  assert.equal(future.check.date_raw, '확인 필요');
  assert.equal(future.needs_review, true);
  const old = v2({ date_raw: '2025-10-01' }, { date: '인계일자: 2025-10-01' });
  assert.ok(old.flags.includes('date_too_old'));
  const edge = v2({ date_raw: '2025-10-05' }, { date: '인계일자: 2025-10-05' });   // 399일 전
  assert.equal(edge.flags.includes('date_too_old'), false);
  assert.equal(v2({ date_raw: '2026-11-08' }, { date: '계량일자: 2026-11-08' }).check.date_raw, '확인됨');
  assert.equal(v2({ date_raw: '2026.10.30' }, { date: '연월일: 2026.10.30' }).check.date_raw, '확인됨');   // 관리대장
  assert.equal(v2({ date_raw: '2026.10.30' }, { date: '차량번호: 2026.10.30' }).check.date_raw, '확인 필요');
});

test('weight labels: 인계서 위탁량, 인수량, 인계량 and 계량표 실중량, 순중량, 정미중량 count', () => {
  for (const label of ['위탁량', '인수량', '인계량', '실중량', '실 중 량', '순중량', '정미중량']) {
    const r = v2({}, { weight: `${label}: 3,150 kg` });
    assert.equal(r.weight_kg, 3150, label);
    assert.equal(r.check.weight_kg, '확인됨', label);
  }
});

test('gross or tare weight is never used as the net weight', () => {
  for (const ev of ['총중량: 3,150 kg', '공차중량: 3,150 kg', '1차(총중량) 3,150 kg']) {
    const r = v2({}, { weight: ev });
    assert.equal(r.weight_kg, null, ev);
    assert.ok(r.flags.includes('weight_not_net'), ev);
  }
});

test('unit from a table header is accepted only when the header text shows it', () => {
  const r = v2({ weight_value: 1.85, weight_unit_raw: '톤', weight_unit_source: '표 머리글' },
    { weight: '위탁처리량: 1.85', weight_unit: '(단위: 톤)' });
  assert.equal(r.weight_kg, 1850);
  assert.equal(r.weight_unit_source, '표 머리글');
  assert.equal(r.check.weight_kg, '확인됨');
  const sameRow = v2({ weight_value: 2240, weight_unit_raw: 'kg', weight_unit_source: '단위 칸' },
    { weight: '실중량: 2,240', weight_unit: '단위: kg' });
  assert.equal(sameRow.weight_kg, 2240);
  // 단위를 어디에서도 보여 주지 못하면 지어낸 단위로 보고 비운다
  const invented = v2({ weight_value: 1.85, weight_unit_raw: '톤', weight_unit_source: '표 머리글' },
    { weight: '위탁처리량: 1.85', weight_unit: null });
  assert.equal(invented.weight_kg, null);
  const mismatch = v2({ weight_value: 1.85, weight_unit_raw: '톤', weight_unit_source: '표 머리글' },
    { weight: '위탁처리량: 1.85', weight_unit: '(단위: kg)' });
  assert.equal(mismatch.weight_kg, null);
  assert.equal(v2({ weight_unit_source: '어딘가' }).weight_unit_source, null);
});

test('weight without a label is kept but needs a check', () => {
  const r = v2({}, { weight: '3,150 kg' });
  assert.equal(r.weight_kg, 3150);
  assert.equal(r.check.weight_kg, '확인 필요');
});

test('null fields are 확인 필요 (must be typed by hand)', () => {
  const r = v2({ weight_value: null, waste_type_raw: null }, { weight: null, waste_type: null });
  assert.equal(r.check.weight_kg, '확인 필요');
  assert.equal(r.check.waste_type_raw, '확인 필요');
});

test('chip mapping: an unmapped waste type is downgraded to 확인 필요', () => {
  const r = v2({ waste_type_raw: '페유' }, { waste_type: '품목: 페유' });
  assert.equal(r.check.waste_type_raw, '확인됨');
  assert.equal(withChipCheck(r, null).check.waste_type_raw, '확인 필요');
  assert.equal(withChipCheck(r, 'C04').check.waste_type_raw, '확인됨');
});

test('public fields drop the raw model confidence', () => {
  const p = publicFields(v2());
  assert.equal('model_confidence' in p, false);
  assert.equal('confidence' in p, false);
  assert.equal(p.check.weight_kg, '확인됨');
});

test('v2 schema asks for unit source, unit evidence and waste category; prompt names 인계서 weight labels', async () => {
  const { OCR_INSTRUCTIONS } = await import('./ocr/schema.ts');
  const props = OCR_SCHEMA.properties as Record<string, unknown>;
  for (const k of ['weight_unit_source', 'waste_category_raw']) assert.ok(k in props, k);
  assert.ok('weight_unit' in (OCR_SCHEMA.properties.evidence.properties as Record<string, unknown>));
  for (const w of ['위탁량', '인수량', '인계량', '순중량', '실중량', '(단위: 톤)', '총중량', '공차중량']) assert.match(OCR_INSTRUCTIONS, new RegExp(w.replace(/[()]/g, '\\$&')), w);
  assert.match(OCR_INSTRUCTIONS, /운반자: 견본운수\(주\)/);
});

test('processor not found in the processor list is downgraded to 확인 필요 (spelling is not verified)', () => {
  const r = v2({ processor_name_raw: '견분리사이클(주)' }, { processor_name: '처리자: 견분리사이클(주)' });
  assert.equal(r.check.processor_name_raw, '확인됨');
  assert.equal(withProcessorCheck(r, null).check.processor_name_raw, '확인 필요');
  assert.equal(withProcessorCheck(r, 'P0002').check.processor_name_raw, '확인됨');
});
