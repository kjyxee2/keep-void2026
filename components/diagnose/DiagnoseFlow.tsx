'use client';
// 1분 진단 흐름. 0 서류 사진(기본) → 1 품목 → 2 무게와 처리 방식 → 3 위치 → /result/:id
// 서버에 보내는 값: POST /api/diagnoses { chip_id }, PATCH 무게, 출처, 처리 방식, 지금 처리업체, 공장. 처리 방식은 서류에서 짐작하지 않는다.
// 진행 상태는 진단 id별로 이 브라우저에 저장하고(lib/diagnose-state draftStore) 주소에 ?d=<id>를 남겨 새로고침 때 되살린다.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Footnote } from '@/components/ui/Footnote';
import { Input } from '@/components/ui/Input';
import { Option } from '@/components/ui/Option';
import { Tag } from '@/components/ui/Tag';
import { MethodIcon, WasteIcon, type MethodType, type WasteType } from '@/components/brand/Icon';
import { SlideStep } from '@/components/motion';
import { ApiError, completeDiagnosis, createDiagnosis, getChips, getFactory, patchDiagnosis, tokenStore } from '@/lib/api-client';
import type { Chip, DiagnosisPatch, Method, WeightSource } from '@/lib/types';
import {
  draftStore,
  fmtKg,
  formatWeightInput,
  METHOD_LABEL,
  methodSummary,
  parseWeight,
  weightError,
  weightSourceFromDocument,
  isFactoryId,
  type DocValues,
  type PickedFactory,
  type Step,
} from '@/lib/diagnose-state';
import DocumentScan, { type DocumentScanApply, type DocumentScanPhase } from './DocumentScan';
import { FactorySearch } from './FactorySearch';
import { Progress } from './Progress';
import { StepList, type StepListItem } from './StepList';
import styles from './Diagnose.module.css';

const MAIN_CHIPS: Record<string, WasteType> = { C01: '폐합성수지', C02: '폐수처리오니', C03: '폐활성탄', C04: '폐유' };
const METHOD_ICON: Partial<Record<Method, MethodType>> = { 소각: '소각', 매립: '매립' };
const METHODS: Method[] = ['소각', '매립', '에너지회수', '모름'];
const WEIGHT_SOURCES: WeightSource[] = ['계량표', '올바로 인계서', '기타'];
const SOURCE_NOTE = '안산시 폐기물 배출자 신고현황 2026-07';

type Errors = Partial<Record<'chip' | 'weight' | 'method' | 'form', string>>;

export type DiagnoseFlowProps = {
  chips: Chip[] | null;
  /** ?factory= 로 넘어온 신고 공장 id. 브라우저에서 GET /api/factories/:id로 받아 3단계에 미리 채운다 */
  initialFactoryId: string | null;
  initialStep: 0 | 1;
  resumeId: string | null;
};

function apiMessage(e: unknown) {
  if (e instanceof ApiError) {
    if (e.isNetwork) return '연결이 끊겼어요. 다시 시도해 주세요.';
    if (e.status >= 500) return '잠시 문제가 생겼어요. 다시 시도해 주세요.';
    return e.message;
  }
  return '잠시 문제가 생겼어요. 다시 시도해 주세요.';
}

export function DiagnoseFlow({ chips: initialChips, initialFactoryId, initialStep, resumeId }: DiagnoseFlowProps) {
  const router = useRouter();
  const [ready, setReady] = useState(!resumeId);
  const [chips, setChips] = useState<Chip[] | null>(initialChips);
  const [chipsError, setChipsError] = useState(false);
  const [step, setStep] = useState<Step>(initialStep);
  const [dir, setDir] = useState<1 | -1>(1);
  const [navigated, setNavigated] = useState(false);

  const [chipId, setChipId] = useState<string | null>(null);
  const [diagnosisId, setDiagnosisId] = useState<string | null>(null);
  const [createdChip, setCreatedChip] = useState<string | null>(null);
  const [weight, setWeight] = useState('');
  const [weightSource, setWeightSource] = useState<WeightSource | null>(null);
  const [method, setMethod] = useState<Method | null>(null);
  const [processorName, setProcessorName] = useState('');
  const [factory, setFactory] = useState<PickedFactory | null>(null);
  const [doc, setDoc] = useState<DocValues | null>(null);
  const [fromPhoto, setFromPhoto] = useState(initialStep === 0);
  const [scanPhase, setScanPhase] = useState<DocumentScanPhase>('idle');
  const [showAll, setShowAll] = useState(false);
  const [pickedNow, setPickedNow] = useState(false);

  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const flowRef = useRef<HTMLDivElement>(null);

  // 칩 목록: 서버에서 못 받아 왔으면 브라우저에서 다시
  useEffect(() => {
    if (chips) return;
    const ac = new AbortController();
    getChips(ac.signal)
      .then((r) => setChips(r.chips))
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') setChipsError(true);
      });
    return () => ac.abort();
  }, [chips]);

  // ?factory= 공장: 공개 열(GET /api/factories/:id)만 받아 3단계에 미리 채운다. 이미 고른 공장이 있으면 그대로
  useEffect(() => {
    if (resumeId || !isFactoryId(initialFactoryId)) return;
    const ac = new AbortController();
    getFactory(initialFactoryId, ac.signal)
      .then((f) =>
        setFactory((cur) => cur ?? { id: f.id, name: f.name, address: '', dong: f.dong, coord_verified: f.coord_verified, n_waste_types: f.n_waste_types ?? undefined }),
      )
      .catch(() => {
        /* 못 받으면 3단계에서 직접 찾는다 */
      });
    return () => ac.abort();
  }, [initialFactoryId, resumeId]);

  // 새로고침: ?d=<id>의 저장된 진행 상태와 토큰이 둘 다 있을 때만 되살린다
  useEffect(() => {
    if (!resumeId) return;
    const d = draftStore.load(resumeId);
    if (d && tokenStore.get(resumeId)) {
      setDiagnosisId(d.diagnosisId);
      setCreatedChip(d.chipId);
      setChipId(d.chipId);
      setWeight(d.weight);
      setWeightSource(d.weightSource);
      setMethod(d.method);
      setProcessorName(d.processorName);
      setFactory(d.factory ?? null);
      setDoc(d.doc);
      setFromPhoto(!!d.doc);
      setStep(d.step);
    } else {
      router.replace('/diagnose', { scroll: false });
    }
    setReady(true);
  }, [resumeId, router]);

  // 진행 상태 저장(진단이 생긴 뒤부터)
  useEffect(() => {
    if (!diagnosisId || !createdChip || !ready) return;
    draftStore.save({
      v: 1,
      diagnosisId,
      chipId: createdChip,
      step,
      weight,
      weightSource,
      method,
      processorName,
      factory,
      doc,
      updatedAt: Date.now(),
    });
  }, [diagnosisId, createdChip, step, weight, weightSource, method, processorName, factory, doc, ready]);

  const chipById = useMemo(() => new Map((chips ?? []).map((c) => [c.id, c])), [chips]);
  const chip = chipId ? chipById.get(chipId) ?? null : null;

  const go = useCallback((next: Step) => {
    setErrors({});
    setDir(next > step ? 1 : -1);
    setNavigated(true);
    setStep(next);
    const top = flowRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) flowRef.current?.scrollIntoView({ block: 'start' });
  }, [step]);

  /** 입력 오류가 난 첫 칸으로 초점을 옮긴다 */
  function focusFirst(selector: string) {
    requestAnimationFrame(() => flowRef.current?.querySelector<HTMLElement>(selector)?.focus());
  }

  /** 고른 칩으로 진단을 만든다. 이미 같은 칩으로 만든 진단이 있으면 그대로 쓴다(PATCH로 칩을 바꿀 수 없음) */
  async function ensureDiagnosis(id: string): Promise<string> {
    if (diagnosisId && createdChip === id) return diagnosisId;
    const res = await createDiagnosis(id);
    setDiagnosisId(res.id);
    setCreatedChip(id);
    router.replace(`/diagnose?d=${encodeURIComponent(res.id)}`, { scroll: false });
    return res.id;
  }

  // ---------- 0단계 ----------

  const onPhaseChange = useCallback((p: DocumentScanPhase) => setScanPhase(p), []);

  async function applyDoc(v: DocumentScanApply) {
    const values: DocValues = {
      document_type: v.document_type,
      weight_kg: v.weight_kg,
      chip_id: v.chip_id && chipById.size && !chipById.has(v.chip_id) ? null : v.chip_id,
      chip_label: v.chip_label,
      waste_type_raw: v.waste_type_raw,
      processor_id: v.processor_id,
      processor_name: v.processor_name,
    };
    const w = values.weight_kg ?? v.typed_weight_kg;
    const src = values.weight_kg !== null ? weightSourceFromDocument(values.document_type) : null;
    setDoc(values);
    setFromPhoto(true);
    if (w !== null) setWeight(formatWeightInput(String(w)));
    if (src) setWeightSource(src);
    setProcessorName(values.processor_name ?? v.typed_processor_name ?? '');
    if (!values.chip_id) {
      setChipId(null);
      go(1);
      return;
    }
    setChipId(values.chip_id);
    setBusy(true);
    try {
      const id = await ensureDiagnosis(values.chip_id);
      const patch: DiagnosisPatch = {};
      if (w !== null) patch.weight_kg_per_month = w;
      if (src) patch.weight_source = src;
      if (Object.keys(patch).length) await patchDiagnosis(id, patch);
      go(2);
    } catch (e) {
      setErrors({ form: apiMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  function manual() {
    setDoc(null);
    setFromPhoto(false);
    go(1);
  }

  // ---------- 1단계 ----------

  async function nextFromWaste() {
    if (!chipId) {
      setErrors({ chip: '폐기물 종류를 하나 골라 주세요.' });
      focusFirst('input[name="chip"]');
      return;
    }
    setBusy(true);
    try {
      const id = await ensureDiagnosis(chipId);
      // 서류에서 읽은 무게가 있으면 새 진단에도 넣어 둔다(2단계에서 다시 확인)
      const w = parseWeight(weight);
      if (w && w > 0 && createdChip !== chipId) {
        await patchDiagnosis(id, { weight_kg_per_month: w, ...(weightSource ? { weight_source: weightSource } : {}) });
      }
      go(2);
    } catch (e) {
      setErrors({ form: apiMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  // ---------- 2단계 ----------

  async function nextFromWeight() {
    const we = weightError(weight);
    const me = method ? null : '지금 처리 방식을 하나 골라 주세요. 모르면 잘 모르겠어요를 골라 주세요.';
    if (we || me) {
      setErrors({ ...(we ? { weight: we } : {}), ...(me ? { method: me } : {}) });
      focusFirst(we ? 'input[inputmode="numeric"]' : 'input[name="method"]');
      return;
    }
    if (!diagnosisId) {
      go(1);
      return;
    }
    setBusy(true);
    try {
      // 지금 맡기는 처리업체: 서류에서 목록 업체로 맞춰진 이름 그대로면 id, 고쳤거나 목록에 없으면 이름 원문만
      const procName = processorName.trim().slice(0, 100);
      const procId = doc?.processor_id && doc.processor_name && procName === doc.processor_name ? doc.processor_id : null;
      await patchDiagnosis(diagnosisId, {
        weight_kg_per_month: parseWeight(weight)!,
        current_method: method!,
        ...(weightSource ? { weight_source: weightSource } : {}),
        current_processor_id: procId,
        current_processor_name_raw: procId ? null : procName || null,
      });
      go(3);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        router.push(`/result/${encodeURIComponent(diagnosisId)}`);
        return;
      }
      setErrors({ form: apiMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  // ---------- 3단계 ----------

  async function finish() {
    if (!diagnosisId) {
      go(1);
      return;
    }
    setBusy(true);
    try {
      if (factory) await patchDiagnosis(diagnosisId, { factory_id: factory.id, location_source: '신고공장' });
      await completeDiagnosis(diagnosisId);
      draftStore.remove(diagnosisId);
      router.push(`/result/${encodeURIComponent(diagnosisId)}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        draftStore.remove(diagnosisId);
        router.push(`/result/${encodeURIComponent(diagnosisId)}`);
        return;
      }
      if (e instanceof ApiError && e.status === 422) {
        go(2);
        setErrors({ form: '무게와 처리 방식을 다시 확인해 주세요. 둘 다 있어야 결과를 볼 수 있어요.' });
        setBusy(false);
        return;
      }
      setErrors({ form: apiMessage(e) });
      setBusy(false);
    }
  }

  // ---------- 화면 ----------

  const weightN = parseWeight(weight);
  const weightSummary = weightN ? `한 달 ${fmtKg(weightN)}` : null;
  const stepTwoDone = [weightN ? fmtKg(weightN) : null, methodSummary(method)].filter(Boolean).join(', ') || null;

  const listItems: StepListItem[] = [
    ...(fromPhoto
      ? [{
          step: 0 as Step,
          title: '서류 사진',
          current: scanPhase === 'reading' ? '읽는 중' : scanPhase === 'done' ? '확인 중' : scanPhase === 'error' ? '다시 찍기' : '사진 올리기',
          done: doc ? '읽은 값 사용' : null,
          idle: '사진 올리기',
        }]
      : []),
    { step: 1, title: '품목', current: '입력 중', done: chip?.label ?? null, idle: '폐기물 종류' },
    { step: 2, title: '무게와 처리 방식', current: '입력 중', done: stepTwoDone, idle: '한 달 무게, 처리 방식' },
    { step: 3, title: '위치', current: '입력 중', done: null, idle: '신고 사업장 찾기(선택)' },
  ];

  const progress: Record<Step, [string, string]> = {
    0: ['0 / 3 서류 사진', '직접 입력해도 돼요'],
    1: ['1 / 3단계', '폐기물 종류부터 골라요'],
    2: ['2 / 3단계', '거의 다 왔어요'],
    3: ['3 / 3단계', '마지막 단계예요'],
  };

  const readTag = <Tag tone="basis">서류에서 읽음</Tag>;
  const weightFromDoc = !!doc && doc.weight_kg !== null && weightN === doc.weight_kg;
  const chipFromDoc = !!doc && !!doc.chip_id && doc.chip_id === chipId;
  const procFromDoc = !!doc && !!doc.processor_name && processorName === doc.processor_name;

  if (!ready) {
    return (
      <div className={styles.flow} ref={flowRef}>
        <p className={styles.restoring} role="status">진행하던 진단을 불러오는 중이에요</p>
      </div>
    );
  }

  const backToHome = step === 0 || (step === 1 && !fromPhoto);

  return (
    <div className={styles.flow} ref={flowRef}>
      <div className={styles.backRow}>
        {backToHome ? (
          <Link href="/" className={styles.back}>홈으로</Link>
        ) : (
          <button type="button" className={styles.back} onClick={() => go((step - 1) as Step)} disabled={busy}>
            이전 단계
          </button>
        )}
      </div>

      <div className={styles.layout}>
        <aside className={styles.aside}>
          <StepList items={listItems} step={step} />
        </aside>

        <div className={styles.main}>
          <Progress label={progress[step][0]} hint={progress[step][1]} ratio={step / 3} />

          <SlideStep stepKey={step} direction={dir} className={styles.stepBody}>
            {step === 0 && (
              <>
                <StepHeading focus={navigated}>
                  {scanPhase === 'done' ? '서류에서 이렇게 읽었어요' : '가지고 있는 서류가 있나요?'}
                </StepHeading>
                <DocumentScan
                  onApply={applyDoc}
                  onManual={manual}
                  onPhaseChange={onPhaseChange}
                  applying={busy}
                  applyError={errors.form}
                />
              </>
            )}

            {step === 1 && (
              <>
                <StepHeading focus={navigated}>어떤 폐기물이 나오나요?</StepHeading>
                {doc && !doc.chip_id && (
                  <p className={styles.notice}>
                    {doc.waste_type_raw
                      ? `서류에서 "${doc.waste_type_raw}"(이)라고 읽었어요. 목록에서 맞는 것을 골라 주세요.`
                      : '서류에서 폐기물 종류를 찾지 못했어요. 목록에서 골라 주세요.'}
                  </p>
                )}
                {chips === null ? (
                  <p className={styles.notice} role={chipsError ? 'alert' : 'status'}>
                    {chipsError ? '폐기물 목록을 불러오지 못했어요. 새로고침해 주세요.' : '폐기물 목록을 불러오는 중이에요'}
                  </p>
                ) : (
                  <fieldset className={styles.group} aria-describedby={errors.chip ? 'err-chip' : undefined}>
                    <legend className="sr-only">폐기물 종류</legend>
                    <div className={styles.optionGrid}>
                      {chips.filter((c) => MAIN_CHIPS[c.id]).map((c) => (
                        <Option key={c.id} name="chip" value={c.id} checked={chipId === c.id} fullWidth
                          icon={<WasteIcon type={MAIN_CHIPS[c.id]} size="sm" />}
                          onChange={() => { setChipId(c.id); setErrors({}); }}>
                          {c.label}
                        </Option>
                      ))}
                    </div>
                    {(showAll || (chipId && !MAIN_CHIPS[chipId])) ? (
                      <div className={styles.moreBlock}>
                        <p className={styles.moreTitle}>다른 폐기물</p>
                        <div className={styles.optionGrid}>
                          {chips.filter((c) => !MAIN_CHIPS[c.id]).map((c) => (
                            <Option key={c.id} name="chip" value={c.id} checked={chipId === c.id} fullWidth
                              onChange={() => { setChipId(c.id); setErrors({}); }}>
                              {c.label}
                            </Option>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <button type="button" className={styles.textBtn} onClick={() => setShowAll(true)}>
                        다른 폐기물 {chips.filter((c) => !MAIN_CHIPS[c.id]).length}가지 더 보기
                      </button>
                    )}
                    {errors.chip && <p id="err-chip" className={styles.fieldError} role="alert">{errors.chip}</p>}
                  </fieldset>
                )}
                <Footnote basis="신고 건수">{SOURCE_NOTE}</Footnote>
                <Actions error={errors.form}>
                  <Button onClick={nextFromWaste} loading={busy} disabled={chips === null}>다음: 무게 입력</Button>
                  {!fromPhoto && (
                    <button type="button" className={styles.textBtn} onClick={() => { setFromPhoto(true); go(0); }}>
                      서류 사진으로 입력
                    </button>
                  )}
                </Actions>
              </>
            )}

            {step === 2 && (
              <>
                <Summary label="1단계 선택" value={chip?.label ?? ''} tag={chipFromDoc ? readTag : null}
                  onChange={() => go(1)} />
                <StepHeading focus={navigated}>한 달에 얼마나 나오나요?</StepHeading>
                <div className={styles.field}>
                  {weightFromDoc && (
                    <div className={styles.labelTag}>{readTag}</div>
                  )}
                  <Input
                    label="한 달 배출 무게"
                    unit="kg"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="예: 2,000"
                    value={weight}
                    onChange={(e) => { setWeight(formatWeightInput(e.target.value)); setErrors((x) => ({ ...x, weight: undefined })); }}
                    helper={chip?.display_text}
                    error={errors.weight}
                  />
                  {weightFromDoc && (
                    <p className={styles.docNote}>서류 한 장에 적힌 무게예요. 한 달 배출량과 다르면 고쳐 주세요.</p>
                  )}
                </div>

                <fieldset className={styles.group}>
                  <legend className={styles.fieldLabel}>무게를 어디서 봤나요? (선택)</legend>
                  <div className={styles.chipRow}>
                    {WEIGHT_SOURCES.map((s) => (
                      <Option key={s} name="weight_source" value={s} checked={weightSource === s}
                        onChange={() => setWeightSource(s)}>
                        {s}
                      </Option>
                    ))}
                  </div>
                </fieldset>

                <h2 className={styles.subHeading}>지금은 어떻게 처리하고 있나요?</h2>
                <fieldset className={styles.group} aria-describedby={errors.method ? 'err-method' : undefined}>
                  <legend className="sr-only">지금 처리 방식</legend>
                  <div className={styles.optionGrid}>
                    {METHODS.map((m) => {
                      const icon = METHOD_ICON[m];
                      return (
                        <Option key={m} name="method" value={m} checked={method === m} fullWidth
                          icon={icon ? <MethodIcon type={icon} size="sm" /> : undefined}
                          onChange={() => { setMethod(m); setErrors((x) => ({ ...x, method: undefined })); }}>
                          {METHOD_LABEL[m]}
                        </Option>
                      );
                    })}
                  </div>
                  {errors.method && <p id="err-method" className={styles.fieldError} role="alert">{errors.method}</p>}
                </fieldset>

                {(doc?.processor_name || processorName) && (
                  <div className={styles.field}>
                    {procFromDoc && <div className={styles.labelTag}>{readTag}</div>}
                    <Input
                      label="지금 맡기는 처리업체"
                      autoComplete="off"
                      maxLength={100}
                      value={processorName}
                      onChange={(e) => setProcessorName(e.target.value)}
                      helper="서류에 적힌 이름이에요. 다르면 고쳐 주세요. 추천 순위에는 쓰지 않고, 결과 요약에 지금 업체 지역을 적을 때만 써요."
                    />
                  </div>
                )}

                <Footnote basis="직접 입력">{SOURCE_NOTE}</Footnote>
                <Actions error={errors.form}>
                  <Button onClick={nextFromWeight} loading={busy}>다음: 위치 확인</Button>
                </Actions>
              </>
            )}

            {step === 3 && (
              <>
                <Summary label="2단계 선택"
                  value={[weightSummary, methodSummary(method)].filter(Boolean).join(', ')}
                  onChange={() => go(2)} />
                <StepHeading focus={navigated}>사업장이 어디인가요?</StepHeading>
                {factory ? (
                  <FactoryCard factory={factory} focus={pickedNow} onClear={() => { setPickedNow(false); setFactory(null); }} />
                ) : (
                  <FactorySearch onPick={(f) => { setPickedNow(true); setFactory(f); }} />
                )}
                {!factory && (
                  <p className={styles.notice}>
                    찾지 못해도 괜찮아요. 사업장 없이 결과를 보면 같은 폐기물의 안산 신고 경로로 보여 드려요.
                  </p>
                )}
                <Footnote basis="신고 건수">{SOURCE_NOTE}</Footnote>
                <Actions error={errors.form}>
                  <Button onClick={finish} loading={busy}>{factory ? '결과 보기' : '사업장 없이 결과 보기'}</Button>
                </Actions>
              </>
            )}
          </SlideStep>
        </div>
      </div>
    </div>
  );
}

/** 단계 제목. 단계가 바뀌어 새로 나타나면 초점을 받는다(첫 화면에서는 받지 않음) */
function StepHeading({ children, focus }: { children: React.ReactNode; focus: boolean }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focus) ref.current?.focus({ preventScroll: true });
    // 마운트될 때 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <h1 ref={ref} tabIndex={-1} className={styles.heading}>
      {children}
    </h1>
  );
}

function Summary({ label, value, tag, onChange }: { label: string; value: string; tag?: React.ReactNode; onChange: () => void }) {
  return (
    <div className={styles.summary}>
      <span className={styles.summaryLabel}>{label}</span>
      <span className={styles.summaryValue}>{value}</span>
      <button type="button" className={styles.summaryChange} onClick={onChange} aria-label={`${label} ${value} 바꾸기`}>
        바꾸기
      </button>
      {tag}
    </div>
  );
}

function Actions({ children, error }: { children: React.ReactNode; error?: string }) {
  return (
    <div className={styles.actionsWrap}>
      {error && (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>{children}</div>
    </div>
  );
}

function FactoryCard({ factory, onClear, focus }: { factory: PickedFactory; onClear: () => void; focus: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (focus) ref.current?.focus({ preventScroll: true });
    // 고른 직전에만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const located = factory.coord_verified === true;
  return (
    <div className={styles.factoryCard}>
      <p className={styles.factoryCaption}>선택한 사업장</p>
      <p ref={ref} tabIndex={-1} className={styles.factoryName}>{factory.name}</p>
      {factory.address && <p className={styles.factoryAddr}>{factory.address}</p>}
      <div className={styles.factoryPlace}>
        {!located && factory.dong && <span className={styles.dongBadge}>{factory.dong}</span>}
        <p className={styles.factoryNote}>
          {located
            ? '건물 위치가 확인된 사업장이에요.'
            : factory.dong
              ? '주소 위치가 확인되지 않은 사업장이라 지도 점 대신 동 이름으로 보여 드려요.'
              : '주소 위치가 확인되지 않은 사업장이에요.'}
        </p>
      </div>
      <button type="button" className={styles.textBtn} onClick={onClear}>
        다른 사업장 찾기
      </button>
    </div>
  );
}
