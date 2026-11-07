// 연결 요청 시트: 이름, 휴대폰(형식 검사), 같이 맡기기 참여, 카톡 알림 → POST /api/requests → /request/:id.
// 네이티브 <dialog>(showModal)라 초점 가두기와 Esc 닫기가 기본으로 된다. 열고 닫을 때 움직임 없음.
'use client';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CloseIcon } from '@/components/brand/Icon';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Option } from '@/components/ui/Option';
import { ApiError, createRequest } from '@/lib/api-client';
import { requestStore } from '@/lib/request-store';
import { maskPhone, normalizePhone } from '@/lib/result-copy';
import type { Candidate } from '@/lib/types';
import styles from './request.module.css';

export function RequestSheet({
  open,
  onClose,
  candidate,
  diagnosisId,
  chipLabel,
  weightKg,
  joinDefault = true,
}: {
  open: boolean;
  onClose: () => void;
  candidate: Candidate;
  diagnosisId: string;
  chipLabel: string;
  weightKg: number;
  joinDefault?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const nameId = useId();
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [join, setJoin] = useState(joinDefault);
  const [kakao, setKakao] = useState(true);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setJoin(joinDefault);
      setFormError(null);
      d.showModal();
      // 시트가 열리면 첫 입력 칸으로 초점
      document.getElementById(nameId)?.focus();
    }
    if (!open && d.open) d.close();
  }, [open, joinDefault, nameId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const p = normalizePhone(phone);
    const next = {
      name: n ? (n.length > 50 ? '이름은 50자까지 넣을 수 있어요' : undefined) : '이름을 넣어 주세요',
      phone: p ? undefined : '휴대폰 번호를 010-1234-5678 형식으로 넣어 주세요',
    };
    setErrors(next);
    if (next.name || next.phone || !p) return;
    setSending(true);
    setFormError(null);
    try {
      const res = await createRequest({
        diagnosis_id: diagnosisId,
        candidate_id: candidate.candidate_id,
        contact_name: n,
        contact_phone: p,
        join_group: join,
        kakao_notify: kakao,
      });
      requestStore.set({
        request: {
          id: res.id,
          diagnosis_id: res.diagnosis_id,
          candidate_id: res.candidate_id,
          processor_id: res.processor_id,
          status: res.status,
          join_group: res.join_group,
          kakao_notify: res.kakao_notify,
          sla_due_at: res.sla_due_at,
          created_at: res.created_at,
        },
        processor: { name: candidate.name, sigungu: candidate.sigungu },
        chip_label: chipLabel,
        weight_kg_per_month: weightKg,
        phone_masked: maskPhone(p),
      });
      router.push(`/request/${res.id}`);
    } catch (err) {
      setSending(false);
      if (err instanceof ApiError && err.status === 409) setFormError('이 업체에는 이미 진행 중인 연결 요청이 있어요. 업체 연락을 기다려 주세요.');
      else if (err instanceof ApiError && err.status === 403) setFormError('이 진단을 한 브라우저에서만 연결 요청을 보낼 수 있어요.');
      else if (err instanceof ApiError && err.status === 400) setFormError('입력한 값을 다시 확인해 주세요.');
      else setFormError('연결이 끊겼어요. 다시 시도해 주세요');
    }
  }

  return (
    <dialog ref={ref} className={styles.sheet} aria-labelledby="sheet-title" onClose={onClose}>
      <form className={styles.sheetForm} onSubmit={submit} noValidate>
        <div className={styles.sheetHead}>
          <h2 id="sheet-title" className={styles.sheetTitle}>
            {candidate.name}에 연결 요청
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="닫기">
            <CloseIcon size="md" />
          </button>
        </div>
        <p className={styles.sheetLead}>업체가 영업일 2일 안에 전화로 연락해요. 요청만으로는 계약되지 않아요.</p>
        <Input
          label="이름"
          id={nameId}
          name="contact_name"
          autoComplete="name"
          value={name}
          maxLength={50}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <Input
          label="휴대폰 번호"
          name="contact_phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="010-1234-5678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          helper="업체와 RE:FIT 운영자만 봐요"
          error={errors.phone}
        />
        <fieldset className={styles.options}>
          <legend className="sr-only">선택 사항</legend>
          <Option type="checkbox" fullWidth checked={join} onChange={(e) => setJoin(e.target.checked)}>
            같이 맡기기 묶음에 참여 (비용 없음, 언제든 해제)
          </Option>
          <Option type="checkbox" fullWidth checked={kakao} onChange={(e) => setKakao(e.target.checked)}>
            진행 상황을 카톡으로 받기
          </Option>
        </fieldset>
        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}
        <Button type="submit" size="mobile" loading={sending}>
          연결 요청 보내기
        </Button>
      </form>
    </dialog>
  );
}
