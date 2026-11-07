// 서류 사진 자동 입력: 계량표, 인계서 사진에서 인쇄된 값만 읽어 돌려준다. 저장하지 않는다.
// 사진은 메모리에서만 다루고 버린다. 사진 바이트와 읽은 내용은 로그에 남기지 않는다.
import Anthropic from '@anthropic-ai/sdk';
import { anthropicProvider } from '@/lib/ocr/anthropic';
import { matchChip, matchProcessor } from '@/lib/ocr/mapping';
import { withChipCheck, withProcessorCheck } from '@/lib/ocr/checks';
import { normalizeExtraction, publicFields } from '@/lib/ocr/normalize';
import { OcrModelError, selectProvider } from '@/lib/ocr/provider';
import { createLimiter } from '@/lib/ocr/ratelimit';
import { loadReference } from '@/lib/ocr/reference';
import { checkImage, MAX_IMAGE_BYTES } from '@/lib/ocr/validate';
import { db, fail, isOwner, isUuid, json } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// IP당 1분에 6장(최대 연속 6장). 인스턴스 메모리 기준이라 최선 노력 제한
const limiter = createLimiter({ capacity: 6, refillPerSec: 6 / 60 });

const LABELS = {
  values: '서류에 인쇄된 글자만 옮김. 서류에 없는 값은 null. 입력 전 꼭 확인',
  weight: '서류 한 장에 적힌 무게. 톤으로 적힌 경우만 kg로 바꿈(1톤 = 1000kg). 한 달 배출량과 다를 수 있음',
  mapping: '목록 이름과 정확히 같을 때만 연결. 못 찾으면 null, 읽은 글자는 그대로',
  check: '확인됨: 서류의 칸 이름, 값 모양이 맞고 종류, 처리업체는 목록에도 있음. 철자까지 보장하지는 않음. 확인 필요: 그 밖의 경우(빈칸 포함). 모델 신뢰도는 쓰지 않음',
  privacy: '사진은 저장하지 않음',
} as const;

const clientIp = (req: Request) =>
  req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';

export async function POST(req: Request) {
  const choice = selectProvider(process.env);
  if (!choice.ok) {
    console.error('ocr disabled:', choice.reason);
    return fail(503, '지금은 서류 자동 입력을 쓸 수 없어요. 무게와 업체를 직접 입력해 주세요.');
  }

  const limit = limiter.take(clientIp(req));
  if (!limit.ok) {
    return Response.json({ error: '사진을 너무 자주 보냈어요. 잠시 뒤 다시 시도해 주세요.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } });
  }

  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_IMAGE_BYTES + 64 * 1024) return fail(413, '사진이 너무 커요(7.5MB까지). 다시 찍거나 작게 줄여 주세요.');

  const form = await req.formData().catch(() => null);
  const file = form?.get('image');
  if (!form || !(file instanceof Blob)) return fail(400, 'image 필드에 사진 파일을 담아 보내 주세요.');

  // 선택: 진단 id를 보내면 본인 진단인지 확인한다(값은 저장하지 않음)
  const diagnosisId = form.get('diagnosis_id');
  if (diagnosisId !== null) {
    if (typeof diagnosisId !== 'string' || !isUuid(diagnosisId)) return fail(400, 'diagnosis_id 형식이 올바르지 않아요.');
    const { data, error } = await db().from('diagnoses').select('anon_token, user_id').eq('id', diagnosisId).maybeSingle();
    if (error) { console.error('ocr db error:', error.message); return fail(500, 'database error'); }
    if (!data) return fail(404, '진단을 찾을 수 없어요.');
    if (!(await isOwner(req, data))) return fail(403, '이 진단에 대한 권한이 없어요.');
  }

  if (file.size > MAX_IMAGE_BYTES) return fail(413, '사진이 너무 커요(7.5MB까지). 다시 찍거나 작게 줄여 주세요.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkImage(bytes);
  if (!check.ok) return fail(check.status, check.error);

  const provider = anthropicProvider(choice.provider.apiKey, choice.provider.model);
  let raw: unknown;
  try {
    ({ raw } = await provider.extract({ bytes, mime: check.mime, signal: AbortSignal.timeout(20_000) }));
  } catch (e) {
    return providerFail(e);
  }

  let fields = normalizeExtraction(raw);
  let chip_id: string | null = null, chip_label: string | null = null;
  let processor: { id: string; name: string } | null = null;
  try {
    const ref = await loadReference();
    chip_id = matchChip(ref.chips, fields.waste_type_raw);
    chip_label = chip_id ? ref.chipLabels.get(chip_id) ?? null : null;
    fields = withChipCheck(fields, chip_id);   // 칩 목록에 연결되지 않은 종류는 '확인 필요'
    processor = matchProcessor(ref.processors, fields.processor_name_raw);
    fields = withProcessorCheck(fields, processor?.id ?? null);   // 처리업체 목록에 없으면 '확인 필요'
  } catch (e) {
    // 목록을 못 읽어도 읽은 값은 돌려준다(연결만 null, 종류는 '확인 필요')
    fields = withProcessorCheck(withChipCheck(fields, null), null);
    console.error('ocr reference error:', (e as { message?: string })?.message);
  }

  // 모델 confidence는 틀린 값에도 높게 나와 응답에서 뺀다. 화면은 check, flags, needs_review를 쓴다
  return json({
    ...publicFields(fields),
    mapped: { chip_id, chip_label, processor_id: processor?.id ?? null, processor_name: processor?.name ?? null },
    diagnosis_id: diagnosisId ?? null,
    provider: { name: provider.name, model: provider.model },
    labels: LABELS,
  });
}

// 오류 종류와 상태 코드만 로그. 메시지 본문에는 사용자 데이터가 섞일 수 있어 남기지 않는다
function providerFail(e: unknown) {
  if (e instanceof OcrModelError) {
    console.error('ocr model:', e.reason);
    return fail(422, '이 사진에서 글자를 읽지 못했어요. 밝은 곳에서 서류 전체가 보이게 다시 찍거나 직접 입력해 주세요.');
  }
  if (e instanceof Anthropic.APIConnectionTimeoutError || (e instanceof Error && e.name === 'TimeoutError')) {
    console.error('ocr timeout');
    return fail(504, '읽는 데 시간이 너무 걸렸어요. 다시 시도하거나 직접 입력해 주세요.');
  }
  if (e instanceof Anthropic.RateLimitError) {
    console.error('ocr upstream 429');
    return fail(503, '지금 사용하는 사람이 많아요. 잠시 뒤 다시 시도하거나 직접 입력해 주세요.');
  }
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    console.error('ocr upstream auth', e.status);
    return fail(503, '지금은 서류 자동 입력을 쓸 수 없어요. 무게와 업체를 직접 입력해 주세요.');
  }
  if (e instanceof Anthropic.APIError) {
    console.error('ocr upstream error', e.status);
    return fail(502, '서류를 읽는 중 문제가 생겼어요. 다시 시도하거나 직접 입력해 주세요.');
  }
  console.error('ocr unexpected', (e as Error)?.name);
  return fail(500, '서류를 읽는 중 문제가 생겼어요. 다시 시도하거나 직접 입력해 주세요.');
}
