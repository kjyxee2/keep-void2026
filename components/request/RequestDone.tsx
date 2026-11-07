// 연결 요청 완료(Figma 76:405 PC, 76:309 모바일, 시작 130:1705).
// 유일한 연출: 로고 심볼 opacity와 scale 0.96에서 1, 400ms(styles/motion.css .logo-reveal, 줄임 모드 0ms, 스크립트 꺼지면 바로 보임).
// 요청 내용은 요청을 보낸 이 브라우저에 저장한 요약(lib/request-store)으로 그린다. 취소는 화면 안 인라인 확인.
'use client';
import { useEffect, useRef, useState } from 'react';
import { LogoSymbol } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { EmptyState, Skeleton } from '@/components/ui/States';
import { ApiError, cancelRequest } from '@/lib/api-client';
import { requestStore, type RequestSummary } from '@/lib/request-store';
import { num } from '@/lib/result-copy';
import type { RequestStatus } from '@/lib/types';
import styles from './request.module.css';

const STEP_OF: Partial<Record<RequestStatus, number>> = { requested: 0, contacted: 1, sample: 2, contracted: 3, first_pickup: 3 };
const CANCELLABLE: RequestStatus[] = ['requested', 'contacted', 'sample'];

function dueText(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' })}까지`;
}

export function RequestDone({ id }: { id: string }) {
  const [data, setData] = useState<RequestSummary | null | undefined>(undefined);
  const [logoIn, setLogoIn] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    setData(requestStore.get(id));
    const raf = requestAnimationFrame(() => setLogoIn(true));
    return () => cancelAnimationFrame(raf);
  }, [id]);

  const status = data?.request.status;
  const cancelled = status === 'cancelled';

  useEffect(() => {
    if (cancelled) statusRef.current?.focus();
  }, [cancelled]);

  async function doCancel() {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      await cancelRequest(data.request.id, data.request.diagnosis_id);
      requestStore.setStatus(data.request.id, 'cancelled');
      setData({ ...data, request: { ...data.request, status: 'cancelled' } });
      setConfirming(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setError('업체와 진행이 이미 넘어가서 여기서 취소할 수 없어요.');
      else if (e instanceof ApiError && e.status === 403) setError('요청을 보낸 브라우저에서만 취소할 수 있어요.');
      else setError('연결이 끊겼어요. 다시 시도해 주세요');
    } finally {
      setBusy(false);
    }
  }

  const step = status ? (STEP_OF[status] ?? -1) : 0;
  const steps = [
    { title: '요청 보냄', when: '방금', body: data ? `${data.processor.name}에 연결 요청을 보냈어요.` : '연결 요청을 보냈어요.' },
    {
      title: '업체 연락',
      when: data ? `영업일 2일 안, ${dueText(data.request.sla_due_at)}` : '영업일 2일 안',
      body: '업체가 전화로 폐기물 상태와 물량을 확인해요.',
    },
    { title: '시료 확인', when: '업체 일정', body: '필요하면 시료를 보고 받을 수 있는지 알려 줘요.' },
    { title: '견적과 계약', when: '직접 결정', body: '견적을 보고 계약할지 직접 정해요. 요청만으로는 계약되지 않아요.' },
  ];

  return (
    <main id="main" className={styles.page}>
      <section className={styles.band} aria-labelledby="done-title">
        <div className={`container ${styles.wrap} ${styles.bandInner}`}>
          <span className="logo-reveal" data-state={logoIn ? 'after' : 'before'}>
            <LogoSymbol decorative size="lg" className={styles.symbol} />
          </span>
          <div className={styles.bandText}>
            <h1 id="done-title" className={styles.headline}>
              {cancelled ? (
                <span className={styles.line}>요청을 취소했어요.</span>
              ) : (
                <>
                  <span className={styles.line}>요청을 보냈어요.</span>
                  <span className={styles.line}>이제 기다리기만 하면 돼요.</span>
                </>
              )}
            </h1>
            <p className={styles.bandLead}>
              {cancelled
                ? '업체에 연락이 가지 않아요. 다른 업체가 궁금하면 결과 화면에서 다시 볼 수 있어요.'
                : '영업일 2일 안에 업체가 전화로 연락해요. 연락이 없으면 RE:FIT이 대신 확인해 드려요.'}
            </p>
          </div>
        </div>
      </section>

      {data === undefined ? (
        <div className={`container ${styles.wrap} ${styles.empty}`}>
          <Skeleton lines={4} />
        </div>
      ) : data === null ? (
        <div className={`container ${styles.wrap} ${styles.empty}`}>
          <EmptyState title="이 브라우저에 요청 기록이 없어요" action={<Button href="/">홈으로</Button>}>
            <p>요청 내용과 취소는 요청을 보낸 브라우저에서 볼 수 있어요.</p>
          </EmptyState>
        </div>
      ) : (
        <div className={`container ${styles.wrap} ${styles.body}`}>
          <section className={styles.next} aria-labelledby="next-title">
            <h2 id="next-title" className={styles.sectionTitle}>
              다음에 일어나는 일
            </h2>
            <ol role="list" className={styles.timeline}>
              {steps.map((s, i) => {
                const done = !cancelled && i <= step;
                return (
                  <li
                    key={s.title}
                    className={[styles.tlItem, done && styles.tlDone, cancelled && i === 0 && styles.tlCancelled].filter(Boolean).join(' ')}
                  >
                    <span className={styles.tlBox} aria-hidden="true" />
                    <div>
                      <p className={styles.tlHead}>
                        <span className={styles.tlTitle}>{s.title}</span>
                        <span className={styles.tlWhen}>{s.when}</span>
                        <span className="sr-only">{done ? '(완료)' : '(예정)'}</span>
                      </p>
                      <p className={styles.tlBody}>{s.body}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className={styles.nextAction}>
              <Button href="/diagnose">다른 폐기물도 진단하기</Button>
            </div>
          </section>

          <section className={styles.card} aria-labelledby="req-title">
            <h2 id="req-title" className={styles.cardTitle}>
              요청 내용
            </h2>
            <dl className={styles.facts}>
              <div className={styles.fact}>
                <dt>업체</dt>
                <dd>
                  {data.processor.name}
                  {data.processor.sigungu && ` ${data.processor.sigungu}`}
                </dd>
              </div>
              <div className={styles.fact}>
                <dt>폐기물</dt>
                <dd>
                  {data.chip_label} 월 <span className="count">{num(data.weight_kg_per_month)}</span>kg (직접 입력)
                </dd>
              </div>
              <div className={styles.fact}>
                <dt>연락받을 번호</dt>
                <dd className="count">{data.phone_masked}</dd>
              </div>
              <div className={styles.fact}>
                <dt>카톡 알림</dt>
                <dd>{data.request.kakao_notify ? '받기' : '안 받기'}</dd>
              </div>
              <div className={styles.fact}>
                <dt>공동 수거 묶음</dt>
                <dd>{data.request.join_group ? '참여 (비용 없음, 언제든 해제)' : '참여 안 함'}</dd>
              </div>
            </dl>

            {cancelled ? (
              <>
                <p ref={statusRef} tabIndex={-1} className={styles.statusLine} role="status">
                  요청을 취소했어요. 업체에 연락이 가지 않아요.
                </p>
                <Button href={`/result/${data.request.diagnosis_id}`} variant="secondary" size="mobile">
                  결과 다시 보기
                </Button>
              </>
            ) : confirming ? (
              <div className={styles.cancelBox} role="group" aria-labelledby="cancel-q">
                <p id="cancel-q" className={styles.statusLine}>
                  요청을 취소할까요? 업체에 연락이 가지 않아요.
                </p>
                <div className={styles.cancelActions}>
                  <Button onClick={doCancel} loading={busy} arrow={false}>
                    요청 취소
                  </Button>
                  <Button variant="text" onClick={() => setConfirming(false)} disabled={busy}>
                    그대로 두기
                  </Button>
                </div>
              </div>
            ) : (
              status &&
              CANCELLABLE.includes(status) && (
                <Button variant="secondary" size="mobile" onClick={() => setConfirming(true)}>
                  요청 취소하기
                </Button>
              )
            )}
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </section>
        </div>
      )}

      <div className={styles.stickyBar}>
        <Button href="/diagnose" size="mobile">
          다른 폐기물도 진단하기
        </Button>
      </div>
    </main>
  );
}
