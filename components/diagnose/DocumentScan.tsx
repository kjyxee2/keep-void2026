'use client';
// 서류 사진 자동 입력(Figma Document Upload 167:447: Empty, Dragover, Reading, Result, Error).
// 사진을 올리면 서버가 인쇄된 값만 읽어 오고, 사용자가 확인한 뒤 onApply로 넘긴다.
// 이 컴포넌트는 진단을 저장(PATCH)하지 않는다. 사진은 브라우저에서 다시 그려(위치 정보 등 메타데이터 제거) 줄인 뒤 보낸다.
// 보내기 전에 선명도를 먼저 본다(lib/image-quality). 흐리면 다시 찍기를 권하되 막지는 않는다("그래도 보내기").
// 칸마다 서버 규칙으로 매긴 "확인됨 / 확인 필요"(check)를 보인다. 모델 신뢰도(confidence)는 응답에 없다.
import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { fmtKg, formatWeightInput, parseWeight, type DocValues } from '@/lib/diagnose-state';
import { checkImageQuality, MAX_SIDE, QUALITY_MESSAGES, type QualityReason, type QualityResult } from '@/lib/image-quality';
import { ScanIcon } from './ScanIcon';
import styles from './DocumentScan.module.css';

/** 읽은 값(DocValues) + 서류에 없어서 사용자가 이 화면에서 직접 넣은 값 */
export type DocumentScanApply = DocValues & {
  typed_weight_kg: number | null;
  typed_processor_name: string | null;
};

export type DocumentScanPhase = 'idle' | 'reading' | 'quality' | 'done' | 'error';

/** POST /api/ocr/document 응답(docs/api.md). check는 서버 규칙(근거 칸 이름 + 값 모양 + 목록 연결)으로 매긴 칸별 확인 표시 */
export type OcrCheck = '확인됨' | '확인 필요';
type OcrField = 'weight_kg' | 'waste_type_raw' | 'processor_name_raw' | 'transporter_name_raw' | 'date_raw';
type OcrResponse = {
  document_type: '계량표' | '인계서' | '기타' | '판독불가';
  weight_kg: number | null;
  weight_unit_raw: string | null;
  weight_unit_source: '숫자 옆' | '단위 칸' | '표 머리글' | null;
  waste_type_raw: string | null;
  waste_category_raw: string | null;
  processor_name_raw: string | null;
  transporter_name_raw: string | null;
  date_raw: string | null;
  check: Partial<Record<OcrField, OcrCheck>>;
  flags: string[];
  needs_review: boolean;
  evidence: Partial<Record<OcrField | 'weight_unit', string | null>>;
  mapped: { chip_id: string | null; chip_label: string | null; processor_id: string | null; processor_name: string | null };
};

/** 서버 flags(lib/ocr/checks.ts Flag)의 화면 문구. 모르는 flag는 보이지 않는다 */
const FLAG_TEXT: Record<string, string> = {
  role_swapped: '처리업체와 운반업체 칸이 바뀌어 있어 서로 바꿔 읽었어요.',
  role_conflict: '처리업체와 운반업체 칸을 가려내지 못해 비워 뒀어요.',
  same_company: '처리업체와 운반업체가 같은 이름이에요.',
  waste_category_only: '폐기물 구분(사업장일반폐기물 등)만 있고 종류 칸은 없었어요.',
  waste_label_mismatch: '종류 칸이 아닌 곳에서 읽은 값이라 비워 뒀어요.',
  weight_not_net: '총중량이나 공차중량만 보여 무게를 비워 뒀어요.',
  weight_unit_unshown: '단위가 서류에 보이지 않아 무게를 비워 뒀어요.',
  date_future: '서류 날짜가 오늘보다 뒤예요.',
  date_too_old: '서류 날짜가 1년 넘게 지났어요.',
};

type Props = {
  onApply: (values: DocumentScanApply) => void;
  onManual?: () => void;
  onPhaseChange?: (phase: DocumentScanPhase) => void;
  /** 적용 중(진단 만드는 중)이면 버튼을 잠근다 */
  applying?: boolean;
  /** 적용 중 서버 오류 */
  applyError?: string | null;
  diagnosisId?: string;
  anonToken?: string;
  endpoint?: string;
};

type State =
  | { step: 'idle' }
  | { step: 'reading' }
  /** 흐림 사전 검사에서 걸림. 권고만 하고 "그래도 보내기"로 올릴 수 있다 */
  | { step: 'quality'; reason: QualityReason; blob: Blob }
  | { step: 'done'; result: OcrResponse }
  | { step: 'error'; message: string; unavailable?: boolean };

// Claude 이미지 한도(긴 변 2576px)에 맞춰 줄인다. Vercel 요청 본문 한도(4.5MB) 안에 들도록 품질을 낮춰 다시 시도한다
const MAX_EDGE = 2576;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
// 브라우저 메모리를 지키려고 원본도 상한을 둔다(휴대폰 원본 사진은 보통 10MB 안팎)
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;

class ScanError extends Error {}

/** 브라우저에서 다시 그려 줄인 업로드용 JPEG와, 선명도 검사 결과(긴 변 MAX_SIDE 이하 캔버스의 ImageData로 계산) */
async function prepare(file: File): Promise<{ blob: Blob; quality: QualityResult }> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // 이 브라우저가 못 여는 형식(HEIC 등). 원본을 그대로 보내면 메타데이터가 같이 가므로 보내지 않는다
    throw new ScanError('이 사진 형식은 열 수 없어요. JPG나 PNG로 찍어 다시 올리거나 직접 입력해 주세요.');
  }
  try {
    const quality = measureQuality(bmp);
    for (const [edge, q] of [[MAX_EDGE, 0.88], [MAX_EDGE, 0.75], [2000, 0.75]] as const) {
      const scale = Math.min(1, edge / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bmp.width * scale));
      canvas.height = Math.max(1, Math.round(bmp.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q));
      if (blob && blob.size <= MAX_UPLOAD_BYTES) return { blob, quality };
    }
  } finally {
    bmp.close();
  }
  throw new ScanError('사진을 줄이지 못했어요. 다시 찍거나 직접 입력해 주세요.');
}

// 선명도는 긴 변 MAX_SIDE(1024px) 이하로 줄인 캔버스에서 잰다. 캔버스를 못 쓰면 검사를 건너뛴다(막지 않음)
function measureQuality(bmp: ImageBitmap): QualityResult {
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { ok: true, score: 0, reason: null };
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // 긴 변 400px 미만(too_small) 판정: 줄이기는 1024px보다 클 때만 하므로 줄인 그림으로 판단해도 원본 기준과 같다
    return checkImageQuality(img);
  } catch {
    return { ok: true, score: 0, reason: null };
  }
}

function retryAfterText(res: Response) {
  const s = Number(res.headers.get('Retry-After'));
  return Number.isFinite(s) && s > 0 ? ` ${Math.ceil(s)}초 뒤에 다시 올릴 수 있어요.` : '';
}

export default function DocumentScan({
  onApply,
  onManual,
  onPhaseChange,
  applying = false,
  applyError,
  diagnosisId,
  anonToken,
  endpoint = '/api/ocr/document',
}: Props) {
  const uid = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLHeadingElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<State>({ step: 'idle' });
  const [dragging, setDragging] = useState(false);
  const [coarse, setCoarse] = useState(false);
  const [typedWeight, setTypedWeight] = useState('');
  const [typedProcessor, setTypedProcessor] = useState('');

  useEffect(() => {
    try {
      setCoarse(window.matchMedia('(pointer: coarse)').matches);
    } catch {
      /* 무시 */
    }
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    onPhaseChange?.(state.step);
    if (state.step === 'done') resultRef.current?.focus();
    if (state.step === 'error' || state.step === 'quality') errorRef.current?.focus();
  }, [state.step, onPhaseChange]);

  async function read(file: File) {
    if (file.type && !file.type.startsWith('image/')) {
      setState({ step: 'error', message: '사진 파일만 올릴 수 있어요. 계량표나 인계서를 찍은 사진을 골라 주세요.' });
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setState({ step: 'error', message: '사진이 너무 커요. 다시 찍거나 작게 줄여 올려 주세요.' });
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setTypedWeight('');
    setTypedProcessor('');
    setPreview(URL.createObjectURL(file));
    setState({ step: 'reading' });
    let prepared: { blob: Blob; quality: QualityResult };
    try {
      prepared = await prepare(file);
    } catch (err) {
      if (ac.signal.aborted) return;
      setState({ step: 'error', message: err instanceof ScanError ? err.message : '사진을 열지 못했어요. 다시 찍거나 직접 입력해 주세요.' });
      return;
    }
    if (ac.signal.aborted) return;
    // 흐리거나 작으면 보내기 전에 알린다(권고만). 그래도 보내기를 누르면 그대로 올린다
    if (!prepared.quality.ok && prepared.quality.reason) {
      setState({ step: 'quality', reason: prepared.quality.reason, blob: prepared.blob });
      return;
    }
    await upload(prepared.blob, ac);
  }

  async function upload(blob: Blob, ac: AbortController) {
    setState({ step: 'reading' });
    try {
      const form = new FormData();
      form.append('image', blob, 'document.jpg');
      if (diagnosisId) form.append('diagnosis_id', diagnosisId);
      const res = await fetch(endpoint, {
        method: 'POST',
        body: form,
        signal: ac.signal,
        headers: anonToken ? { 'x-anon-token': anonToken } : undefined,
      });
      const data = await res.json().catch(() => null);
      if (ac.signal.aborted) return;
      if (!res.ok || !data || typeof data !== 'object') {
        const msg = typeof data?.error === 'string' ? data.error : '서류를 읽지 못했어요. 다시 찍거나 직접 입력해 주세요.';
        // 503: 자동 입력을 지금 쓸 수 없음 → 직접 입력을 앞에 둔다
        setState({ step: 'error', message: res.status === 429 ? msg + retryAfterText(res) : msg, unavailable: res.status === 503 });
        return;
      }
      setState({ step: 'done', result: data as OcrResponse });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setState({ step: 'error', message: '연결이 불안정해요. 다시 시도하거나 직접 입력해 주세요.' });
    }
  }

  /** 흐림 안내에서 "그래도 보내기" */
  function sendAnyway() {
    if (state.step !== 'quality') return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    void upload(state.blob, ac);
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void read(file);
  }

  function pick() {
    inputRef.current?.click();
  }

  function retake() {
    abortRef.current?.abort();
    setPreview(null);
    setState({ step: 'idle' });
    pick();
  }

  function onDrag(e: DragEvent<HTMLDivElement>, over: boolean) {
    if (state.step !== 'idle' && state.step !== 'error') return;
    e.preventDefault();
    setDragging(over);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    if (state.step !== 'idle' && state.step !== 'error') return;
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void read(file);
  }

  const result = state.step === 'done' ? state.result : null;

  function apply() {
    if (!result) return;
    const typed = parseWeight(typedWeight);
    onApply({
      document_type: result.document_type,
      weight_kg: result.weight_kg,
      chip_id: result.mapped.chip_id,
      chip_label: result.mapped.chip_label,
      waste_type_raw: result.waste_type_raw,
      processor_id: result.mapped.processor_id,
      processor_name: result.mapped.processor_name ?? result.processor_name_raw,
      typed_weight_kg: result.weight_kg === null && typed !== null && typed > 0 ? typed : null,
      typed_processor_name: !result.processor_name_raw && typedProcessor.trim() ? typedProcessor.trim().slice(0, 100) : null,
    });
  }

  const status =
    state.step === 'reading' ? '서류를 읽는 중이에요. 10초쯤 걸려요.'
    : state.step === 'quality' ? `보내기 전에 확인해 주세요. ${QUALITY_MESSAGES[state.reason]}`
    : state.step === 'done' ? '서류를 다 읽었어요. 읽은 값을 확인해 주세요.'
    : state.step === 'error' ? `사진을 읽지 못했어요. ${state.message}`
    : '';

  const fileInput = (
    <input
      ref={inputRef}
      className={styles.file}
      type="file"
      accept="image/*"
      capture={coarse ? 'environment' : undefined}
      tabIndex={-1}
      aria-hidden="true"
      onChange={onPick}
    />
  );

  const pickLabel = (
    <span className={styles.btnLabel}>
      <ScanIcon className={styles.btnIcon} />
      {coarse ? '사진 찍기' : '사진 올리기'}
    </span>
  );

  return (
    <div className={styles.root}>
      {fileInput}
      <p className="sr-only" role="status" aria-live="polite">{status}</p>

      {(state.step === 'idle' || state.step === 'error') && (
        <div
          className={[styles.box, styles.drop, dragging && styles.dragging, state.step === 'error' && styles.errorBox]
            .filter(Boolean)
            .join(' ')}
          onDragOver={(e) => onDrag(e, true)}
          onDragEnter={(e) => onDrag(e, true)}
          onDragLeave={(e) => onDrag(e, false)}
          onDrop={onDrop}
        >
          <span className={[styles.tile, state.step === 'error' && styles.tileError].filter(Boolean).join(' ')}>
            <ScanIcon className={styles.tileIcon} />
          </span>
          {state.step === 'error' ? (
            <>
              <h2 ref={errorRef} tabIndex={-1} className={styles.boxTitle}>사진을 읽지 못했어요.</h2>
              <p className={styles.boxHelp}>{state.message}</p>
            </>
          ) : dragging ? (
            <>
              <h2 className={styles.boxTitle}>여기에 놓으면 바로 읽어 드려요</h2>
              <p className={styles.boxHelp}>사진 한 장을 놓아 주세요. 사진은 저장하지 않아요.</p>
            </>
          ) : (
            <>
              <h2 className={styles.boxTitle}>계량표나 인계서 사진을 올려 주세요</h2>
              <p className={styles.boxHelp}>찍은 사진에서 무게와 폐기물 종류, 지금 처리업체를 읽어 드려요. 사진은 저장하지 않아요.</p>
            </>
          )}
          <div className={styles.boxActions}>
            {state.step === 'error' && state.unavailable && onManual ? (
              <>
                <Button className={styles.pickBtn} onClick={onManual}>직접 입력할게요</Button>
                <button type="button" className={styles.manual} onClick={retake}>
                  다시 찍기
                </button>
              </>
            ) : state.step === 'error' ? (
              <Button className={styles.pickBtn} onClick={retake}>
                <span className={styles.btnLabel}>
                  <ScanIcon className={styles.btnIcon} />
                  다시 찍기
                </span>
              </Button>
            ) : (
              <Button className={styles.pickBtn} onClick={pick}>
                {pickLabel}
              </Button>
            )}
            {onManual && !(state.step === 'error' && state.unavailable) && (
              <button type="button" className={styles.manual} onClick={onManual}>
                직접 입력할게요
              </button>
            )}
          </div>
        </div>
      )}

      {state.step === 'quality' && (
        <div className={[styles.box, styles.drop, styles.qualityBox].join(' ')}>
          <div className={styles.thumb}>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- 로컬 blob 미리보기라 next/image 대상이 아님
              <img src={preview} alt="" className={styles.thumbImg} />
            ) : (
              <ScanIcon className={styles.tileIcon} />
            )}
          </div>
          <h2 ref={errorRef} tabIndex={-1} className={styles.boxTitle}>
            {state.reason === 'too_small' ? '사진이 너무 작아요' : '사진이 흔들린 것 같아요'}
          </h2>
          <p className={styles.boxHelp}>{QUALITY_MESSAGES[state.reason]} 그래도 보내면 읽어 보지만, 값이 비거나 틀릴 수 있어요.</p>
          <div className={styles.boxActions}>
            <Button className={styles.pickBtn} onClick={retake}>
              <span className={styles.btnLabel}>
                <ScanIcon className={styles.btnIcon} />
                다시 찍기
              </span>
            </Button>
            <Button variant="secondary" className={styles.pickBtn} onClick={sendAnyway}>
              그래도 보내기
            </Button>
          </div>
        </div>
      )}

      {state.step === 'reading' && (
        <div className={[styles.box, styles.reading].join(' ')} aria-busy="true">
          <div className={styles.thumb}>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- 로컬 blob 미리보기라 next/image 대상이 아님
              <img src={preview} alt="" className={styles.thumbImg} />
            ) : (
              <ScanIcon className={styles.tileIcon} />
            )}
          </div>
          <div className={styles.skeleton} aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className={styles.skGroup}>
                <span className={styles.skLabel} />
                <span className={styles.skValue} />
                <span className={styles.skNote} />
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className={[styles.box, styles.result].join(' ')}>
          <div className={styles.resultHead}>
            <span className={[styles.tile, styles.tileMuted].join(' ')}>
              <ScanIcon className={styles.tileIcon} />
            </span>
            <div>
              <h2 ref={resultRef} tabIndex={-1} className={styles.resultTitle}>서류에서 읽은 값을 확인해 주세요</h2>
              <p className={styles.boxHelp}>
                {result.document_type === '판독불가'
                  ? '서류에서 값을 읽지 못했어요. 다시 찍거나 비어 있는 칸을 직접 채워 주세요.'
                  : '틀린 값은 다음 단계에서 고칠 수 있어요.'}
              </p>
            </div>
          </div>

          <dl className={styles.rows}>
            <Row
              label="무게"
              value={result.weight_kg !== null ? fmtKg(result.weight_kg) : null}
              evidence={result.evidence.weight_kg}
              check={result.weight_kg !== null ? result.check.weight_kg : undefined}
              note={
                result.weight_kg !== null
                  ? `서류 한 장에 적힌 무게예요.${result.weight_unit_source ? ` 단위는 ${result.weight_unit_source}에서 읽었어요.` : ''}`
                  : undefined
              }
              missing={
                <>
                  <p className={styles.missingText}>
                    {result.weight_unit_raw
                      ? `kg로 바꿀 수 없는 단위(${result.weight_unit_raw})라 비워 뒀어요`
                      : '서류에서 찾지 못했어요'}
                  </p>
                  <div className={styles.inlineField}>
                    <input
                      id={`${uid}-w`}
                      className={styles.inlineInput}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="한 달 무게를 적어 주세요"
                      aria-label="한 달 배출 무게(kg)"
                      value={typedWeight}
                      onChange={(e) => setTypedWeight(formatWeightInput(e.target.value))}
                    />
                    <span className={styles.inlineUnit} aria-hidden="true">kg</span>
                  </div>
                </>
              }
            />
            <Row
              label="폐기물"
              value={result.mapped.chip_label ?? null}
              evidence={result.evidence.waste_type_raw}
              check={result.mapped.chip_label ? result.check.waste_type_raw : undefined}
              missing={
                <p className={styles.missingText}>
                  {result.waste_type_raw
                    ? `"${result.waste_type_raw}"(으)로 읽었지만 목록에서 찾지 못했어요. 다음 단계에서 골라 주세요`
                    : result.waste_category_raw
                      ? `구분 "${result.waste_category_raw}"만 있고 종류 칸은 찾지 못했어요. 다음 단계에서 골라 주세요`
                      : '서류에서 찾지 못했어요. 다음 단계에서 골라 주세요'}
                </p>
              }
            />
            <Row
              label="처리업체"
              value={result.mapped.processor_name ?? result.processor_name_raw}
              evidence={result.evidence.processor_name_raw}
              check={result.processor_name_raw ? result.check.processor_name_raw : undefined}
              missing={
                <>
                  <p className={styles.missingText}>서류에서 찾지 못했어요</p>
                  <input
                    className={[styles.inlineInput, styles.inlineAlone].join(' ')}
                    autoComplete="off"
                    placeholder="지금 맡기는 업체 이름(선택)"
                    aria-label="지금 맡기는 처리업체 이름(선택)"
                    maxLength={100}
                    value={typedProcessor}
                    onChange={(e) => setTypedProcessor(e.target.value)}
                  />
                </>
              }
            />
          </dl>

          {result.needs_review && result.flags.some((f) => FLAG_TEXT[f]) && (
            <ul role="list" className={styles.flags} aria-label="확인할 점">
              {result.flags.filter((f) => FLAG_TEXT[f]).map((f) => (
                <li key={f} className={styles.flag}>{FLAG_TEXT[f]}</li>
              ))}
            </ul>
          )}

          {applyError && (
            <p className={styles.applyError} role="alert">
              {applyError}
            </p>
          )}
          <div className={styles.resultActions}>
            <Button onClick={apply} loading={applying}>
              이 값으로 입력
            </Button>
            <Button variant="secondary" onClick={retake} disabled={applying}>
              다시 찍기
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  evidence,
  check,
  note,
  missing,
}: {
  label: string;
  value: string | null;
  evidence: string | null | undefined;
  /** 서버가 매긴 칸 확인 표시. 값이 없으면 보이지 않는다 */
  check?: OcrCheck;
  note?: string;
  missing: React.ReactNode;
}) {
  const shown = value ? check : undefined;
  return (
    <div className={styles.row}>
      <dt className={styles.rowLabel}>{label}</dt>
      <dd className={styles.rowBody}>
        {value ? (
          <>
            <p className={styles.rowValue}>{value}</p>
            {evidence && <p className={styles.rowEvidence}>서류에서 읽은 글자 &ldquo;{evidence}&rdquo;</p>}
            {note && <p className={styles.rowEvidence}>{note}</p>}
          </>
        ) : (
          missing
        )}
      </dd>
      <dd className={styles.rowConf}>
        {shown && (
          <span className={styles.check} data-check={shown === '확인됨' ? 'ok' : 'needs'}>
            <span className={styles.checkDot} aria-hidden="true" />
            {shown}
          </span>
        )}
      </dd>
    </div>
  );
}
