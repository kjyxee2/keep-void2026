'use client';
// 서류 사진 자동 입력. 사진을 찍으면 서버가 인쇄된 값만 읽어 오고, 사용자가 확인한 뒤 onApply로 넘긴다.
// 이 컴포넌트는 진단을 직접 저장(PATCH)하지 않는다.
import { useEffect, useId, useRef, useState } from 'react';
import styles from './DocumentScan.module.css';

export type DocumentScanApply = { weight_kg: number | null; chip_id: string | null; processor_id: string | null };

type OcrResponse = {
  document_type: '계량표' | '인계서' | '기타' | '판독불가';
  weight_kg: number | null;
  weight_unit_raw: string | null;
  waste_type_raw: string | null;
  processor_name_raw: string | null;
  transporter_name_raw: string | null;
  date_raw: string | null;
  confidence: { weight_kg: number; waste_type_raw: number; processor_name_raw: number };
  evidence: { weight_kg: string | null; waste_type_raw: string | null; processor_name_raw: string | null;
              transporter_name_raw: string | null; date_raw: string | null };
  mapped: { chip_id: string | null; chip_label: string | null; processor_id: string | null; processor_name: string | null };
};

type Props = {
  onApply: (values: DocumentScanApply) => void;
  onManual?: () => void;
  diagnosisId?: string;
  anonToken?: string;
  endpoint?: string;
};

type State =
  | { step: 'idle' }
  | { step: 'reading' }
  | { step: 'done'; result: OcrResponse }
  | { step: 'error'; message: string };

// Claude 고해상도 이미지 한도(긴 변 2576px)에 맞춰 줄인다. 업로드 크기도 줄어 서버 본문 한도 안에 든다
const MAX_EDGE = 2576;

async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.88));
    return blob ?? file;
  } catch {
    return file;   // 브라우저가 못 여는 형식(HEIC 등)은 그대로 보내고 서버 안내를 보여 준다
  }
}

const fmtKg = (n: number) => `${n.toLocaleString('ko-KR')} kg`;

function ConfidenceHint({ value }: { value: number | undefined }) {
  if (value === undefined) return null;
  if (value >= 0.85) return <span className={styles.hintOk}>또렷하게 읽음</span>;
  if (value >= 0.6) return <span className={styles.hintWarn}>한 번 더 확인</span>;
  return <span className={styles.hintLow}>흐릿함, 꼭 확인</span>;
}

export default function DocumentScan({ onApply, onManual, diagnosisId, anonToken, endpoint = '/api/ocr/document' }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<State>({ step: 'idle' });

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => { if (state.step === 'done') resultRef.current?.focus(); }, [state.step]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setState({ step: 'reading' });
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const form = new FormData();
      form.append('image', await shrink(file), 'document.jpg');
      if (diagnosisId) form.append('diagnosis_id', diagnosisId);
      const res = await fetch(endpoint, {
        method: 'POST', body: form, signal: ac.signal,
        headers: anonToken ? { 'x-anon-token': anonToken } : undefined,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setState({ step: 'error', message: data?.error ?? '서류를 읽지 못했어요. 다시 찍거나 직접 입력해 주세요.' });
        return;
      }
      setState({ step: 'done', result: data as OcrResponse });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setState({ step: 'error', message: '연결이 불안정해요. 다시 시도하거나 직접 입력해 주세요.' });
    }
  }

  function retake() {
    abortRef.current?.abort();
    setState({ step: 'idle' });
    setPreview(null);
    inputRef.current?.click();
  }

  const result = state.step === 'done' ? state.result : null;
  const applicable = result && (result.weight_kg !== null || result.mapped.chip_id || result.mapped.processor_id);
  const status =
    state.step === 'reading' ? '서류를 읽는 중이에요.'
    : state.step === 'error' ? state.message
    : result && !applicable ? '서류에서 입력할 값을 찾지 못했어요. 다시 찍거나 직접 입력해 주세요.'
    : result ? '읽은 값을 확인해 주세요. 맞으면 이 값으로 입력을 눌러 주세요.'
    : '';

  return (
    <section className={styles.root} aria-labelledby={`${inputId}-title`}>
      <h3 id={`${inputId}-title`} className={styles.title}>서류 사진으로 입력</h3>
      <p className={styles.help}>계량표나 올바로 인계서를 찍으면 서류에 적힌 무게, 폐기물 종류, 처리업체를 읽어 와요. 사진은 저장하지 않아요.</p>

      <input
        ref={inputRef}
        id={inputId}
        className={styles.file}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="서류 사진 찍기"
        onChange={onPick}
        disabled={state.step === 'reading'}
      />
      {state.step === 'idle' && (
        <label htmlFor={inputId} className={styles.primary}>서류 사진 찍기</label>
      )}

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element -- 로컬 blob 미리보기라 next/image 최적화 대상이 아님
        <img src={preview} alt="찍은 서류 미리보기" className={styles.preview} />
      )}

      <p className={state.step === 'error' ? styles.error : styles.status} role="status" aria-live="polite">{status}</p>

      {state.step === 'reading' && (
        <div className={styles.skeleton} aria-hidden="true">
          <span /><span /><span />
        </div>
      )}

      {result && (
        <div ref={resultRef} tabIndex={-1} className={styles.result}>
          <table className={styles.table}>
            <caption className={styles.caption}>서류에서 읽은 값({result.document_type})</caption>
            <thead>
              <tr><th scope="col">항목</th><th scope="col">읽은 값</th><th scope="col">서류에 적힌 글자</th></tr>
            </thead>
            <tbody>
              <Row label="무게"
                value={result.weight_kg !== null ? fmtKg(result.weight_kg)
                  : result.weight_unit_raw ? `kg로 바꿀 수 없는 단위(${result.weight_unit_raw})` : null}
                evidence={result.evidence.weight_kg}
                confidence={result.weight_kg !== null ? result.confidence.weight_kg : undefined}
                note={result.weight_kg !== null ? '서류 한 장의 무게예요. 한 달 배출량과 다르면 다음 단계에서 고쳐 주세요.' : undefined} />
              <Row label="폐기물 종류"
                value={result.mapped.chip_label ?? (result.waste_type_raw ? `${result.waste_type_raw} (목록에서 못 찾음)` : null)}
                evidence={result.evidence.waste_type_raw}
                confidence={result.waste_type_raw ? result.confidence.waste_type_raw : undefined} />
              <Row label="처리업체"
                value={result.mapped.processor_name ?? (result.processor_name_raw ? `${result.processor_name_raw} (목록에서 못 찾음)` : null)}
                evidence={result.evidence.processor_name_raw}
                confidence={result.processor_name_raw ? result.confidence.processor_name_raw : undefined} />
              <Row label="운반업체" value={result.transporter_name_raw} evidence={result.evidence.transporter_name_raw} />
              <Row label="날짜" value={result.date_raw} evidence={result.evidence.date_raw} />
            </tbody>
          </table>
          <p className={styles.help}>목록에서 못 찾은 값과 서류에 없는 값은 입력하지 않아요.</p>
        </div>
      )}

      {state.step !== 'idle' && (
        <div className={styles.actions}>
          {result && (
            <button type="button" className={styles.primary} disabled={!applicable}
              onClick={() => onApply({ weight_kg: result.weight_kg, chip_id: result.mapped.chip_id, processor_id: result.mapped.processor_id })}>
              이 값으로 입력
            </button>
          )}
          <button type="button" className={styles.secondary} onClick={retake}>다시 찍기</button>
          {onManual && <button type="button" className={styles.ghost} onClick={onManual}>직접 입력</button>}
        </div>
      )}
      {state.step === 'idle' && onManual && (
        <button type="button" className={styles.ghost} onClick={onManual}>직접 입력</button>
      )}
    </section>
  );
}

function Row({ label, value, evidence, confidence, note }:
  { label: string; value: string | null; evidence: string | null; confidence?: number; note?: string }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>
        {value ?? <span className={styles.missing}>서류에 없음</span>}
        {value && <> <ConfidenceHint value={confidence} /></>}
        {note && <span className={styles.note}>{note}</span>}
      </td>
      <td className={styles.evidence}>{evidence ?? '없음'}</td>
    </tr>
  );
}
