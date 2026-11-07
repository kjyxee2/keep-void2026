// 우리 공장 탭(Figma 151:3000, 151:4960). 이 브라우저의 마지막 완료 진단(GET /api/diagnoses/:id, 토큰 포함).
// 지금 경로는 API가 주는 값만(공장 이름, 운반업체, 처리업체 이름은 응답에 없어 쓰지 않음).
// 고시 단가는 같은 고시 항목 한 줄(2022 값 크게, 2027 값 작게), 무게와 곱하지 않는다. 바꾼 신고 수는 /api/dashboard app.
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MethodIcon, type MethodType } from '@/components/brand/Icon';
import { Button } from '@/components/ui/Button';
import { Footnote } from '@/components/ui/Footnote';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { completedDate } from '@/lib/report-data';
import { loadLatestDiagnosis } from '@/lib/report-latest';
import { mergeNoticeYears, num, SOURCE_REPORTS } from '@/lib/result-copy';
import type { DiagnosisResult, ReferencePrice } from '@/lib/types';
import styles from './report.module.css';

type State = { kind: 'loading' } | { kind: 'none' } | { kind: 'error' } | { kind: 'ok'; d: DiagnosisResult };
type PriceRow = ReferencePrice & { year_label?: string; source?: string };

const METHOD_ICON: Partial<Record<string, MethodType>> = {
  소각: '소각',
  에너지회수: '소각',
  매립: '매립',
};

export function FactoryTab({ active, switched }: { active: boolean; switched: number | null }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const started = useRef(false);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const d = await loadLatestDiagnosis();
      setState(d ? { kind: 'ok', d } : { kind: 'none' });
    } catch {
      setState({ kind: 'error' });
    }
  }, []);

  // 처음 이 탭을 열 때 한 번 읽는다
  useEffect(() => {
    if (!active || started.current) return;
    started.current = true;
    void load();
  }, [active, load]);

  if (state.kind === 'loading')
    return (
      <>
        <noscript>
          <p className={styles.lead}>우리 공장 보고서는 이 브라우저에 남은 진단으로 만들어요. 스크립트를 켜 주세요.</p>
        </noscript>
        <Skeleton lines={4} label="이 브라우저의 진단을 찾는 중이에요" />
      </>
    );
  if (state.kind === 'error') return <ErrorState onRetry={load} />;
  if (state.kind === 'none')
    return (
      <EmptyState
        title="이 브라우저에서 마친 진단이 없어요"
        action={
          <Button href="/diagnose?start=photo" size="pc">
            진단 시작
          </Button>
        }
      >
        <p>계량표나 인계서 사진 한 장으로 1분 진단을 마치면 여기에 우리 공장 보고서가 생겨요.</p>
      </EmptyState>
    );

  const d = state.d;
  const u = d.user_input;
  const date = completedDate(d.completed_at);
  const inAnsan = d.current_route.by_region.find((r) => r.region === '안산');
  const icon = METHOD_ICON[u.current_method];
  const prices = mergeNoticeYears(d.reference_prices as PriceRow[]);
  const priceSources = [...new Set((d.reference_prices as PriceRow[]).map((r) => r.source).filter(Boolean))] as string[];
  const notes = [...new Set(d.reference_prices.map((r) => r.note).filter(Boolean))] as string[];
  const userPrice = u.current_price_won_per_ton ?? null;

  return (
    <div className={styles.stack}>
      <section aria-labelledby="fac-route" className={styles.card}>
        <h2 id="fac-route" className={styles.h3}>
          지금 경로
        </h2>
        <dl className={styles.dl}>
          <div className={styles.dlRow}>
            <dt>폐기물</dt>
            <dd>{u.chip.label}</dd>
          </div>
          <div className={styles.dlRow}>
            <dt>한 달 무게</dt>
            <dd>
              <span>
                <span className="count">{num(u.weight_kg_per_month)}</span>kg
              </span>
              {u.weight_source && <span className={styles.ddSub}>{u.weight_source}에서 읽은 값</span>}
            </dd>
          </div>
          <div className={styles.dlRow}>
            <dt>처리 방식</dt>
            <dd className={styles.ddMethod}>
              {icon && <MethodIcon type={icon} size="sm" />}
              {u.current_method === '모름' ? '잘 모름' : u.current_method}
            </dd>
          </div>
          {inAnsan && (
            <div className={styles.dlRow}>
              <dt>같은 폐기물, 안산 안 처리</dt>
              <dd>
                <span className="count">{inAnsan.pct.toFixed(1)}%</span>
                <span className={styles.ddSub}>안산 공장 같은 폐기물 신고 {num(d.current_route.total_reports)}건 중</span>
              </dd>
            </div>
          )}
          {date && (
            <div className={styles.dlRow}>
              <dt>진단한 날</dt>
              <dd>{date}</dd>
            </div>
          )}
        </dl>
        <Footnote basis="직접 입력">진단 때 넣은 값</Footnote>
        {inAnsan && <Footnote basis="신고 건수">{SOURCE_REPORTS} (톤수 아님)</Footnote>}
        <div data-report-noprint>
          <Button variant="text" href={`/result/${encodeURIComponent(d.diagnosis_id)}`}>
            진단 결과 다시 보기
          </Button>
        </div>
      </section>

      <div className={styles.factoryGrid}>
        <section aria-labelledby="fac-price" className={styles.card}>
          <h2 id="fac-price" className={styles.h3}>
            고시 단가 비교
          </h2>
          <dl className={styles.dl}>
            <div className={styles.dlRow}>
              <dt>우리 공장 단가</dt>
              <dd>
                {userPrice != null ? (
                  <span className={styles.priceBig}>
                    톤당 <span className="count">{num(userPrice)}</span>원
                  </span>
                ) : (
                  <span className={styles.ddMuted}>진단 때 넣지 않았어요</span>
                )}
                {userPrice != null && <span className={styles.ddSub}>진단 때 직접 넣은 값</span>}
              </dd>
            </div>
            {prices.map(({ main, next }) => (
              <div key={main.id} className={styles.dlRow}>
                <dt>
                  {main.item}
                  <span className={styles.dtSub}>
                    {main.method}, {main.category}, {main.year_label ?? `${main.year}년`}
                  </span>
                </dt>
                <dd>
                  <span className={styles.priceBig}>
                    톤당 <span className="count">{num(main.price_won)}</span>원
                  </span>
                  {next && (
                    <span className={styles.ddSub}>
                      2027년부터 <span className="count">{num(next.price_won)}</span>원
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {prices.length === 0 && <p className={styles.lead}>이 폐기물에 맞는 고시 단가 행이 없어요.</p>}
          {notes.length > 0 && (
            <ul role="list" className={styles.notes}>
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          <p className={styles.small}>단가는 무게와 곱하지 않아요. RE:FIT은 예상 절감액을 계산하지 않아요.</p>
          {priceSources.length > 0 && (
            <Footnote basis="고시 단가">
              {priceSources.map((s) => (
                <span key={s} className={styles.block}>
                  {s}
                </span>
              ))}
            </Footnote>
          )}
        </section>

        {switched != null && (
          <section aria-labelledby="fac-switched" className={styles.switched}>
            <h2 id="fac-switched" className="sr-only">
              바꾼 신고 수
            </h2>
            <p className={`${styles.switchedValue} count`}>{num(switched)}건</p>
            <p className={styles.switchedLabel}>RE:FIT으로 소각과 매립에서 재활용으로 바꾼 신고</p>
            <Footnote basis="앱 집계">RE:FIT 서비스 기록</Footnote>
          </section>
        )}
      </div>
    </div>
  );
}
