// 결과 화면(Figma 76:168 PC, 76:11 모바일). 서버가 공유 보기 값을 먼저 그리고,
// 이 브라우저에 진단 토큰이 있으면 전체 응답과 같이 맡기기 묶음을 다시 받아 바꾼다.
'use client';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { CandidateCard } from '@/components/ui/CandidateCard';
import { Tag } from '@/components/ui/Tag';
import { Footnote } from '@/components/ui/Footnote';
import { EmptyState } from '@/components/ui/States';
import { RequestSheet } from '@/components/request/RequestSheet';
import { getDiagnosis, getGroup, tokenStore } from '@/lib/api-client';
import {
  ANSAN_CANDIDATE,
  EMPTY_CANDIDATES,
  candidateEvidence,
  SOURCE_REPORTS,
  neighborsBurnLabel,
  neighborsRecycleLabel,
  num,
  summaryLines,
} from '@/lib/result-copy';
import type { Candidate, DiagnosisResult, GroupItem } from '@/lib/types';
import { GroupFit } from './GroupFit';
import { ReferencePrices } from './ReferencePrices';
import { RouteBar } from './RouteBar';
import { ShareButton } from './ShareButton';
import { SwitchGuide } from './SwitchGuide';
import styles from './result.module.css';

/** 추천 이유 목록. 이웃 수 이유는 근거 한 줄과 같은 문장이라 목록에서 뺀다 */
const reasonTexts = (c: Candidate) =>
  (c.reasons ?? []).filter((r) => r && r.type !== 'neighbors_same_group' && typeof r.text === 'string' && r.text).map((r) => r.text);

function ResultCandidate({ candidate: c, tags, action }: { candidate: Candidate; tags?: ReactNode; action?: ReactNode }) {
  return (
    <CandidateCard
      rank={c.rank}
      headingId={`cand-${c.candidate_id}`}
      name={c.name}
      region={c.sigungu ?? '지역 정보 없음'}
      meta={[c.distance_km == null ? '거리 정보 없음' : `직선 ${c.distance_km}km`]}
      neighbors={c.neighbors}
      evidence={candidateEvidence(c.neighbors)}
      reasons={reasonTexts(c)}
      tags={tags}
      note={c.note}
      source={SOURCE_REPORTS}
      action={action}
    />
  );
}

export function ResultView({ initial }: { initial: DiagnosisResult }) {
  const [data, setData] = useState(initial);
  // unknown: 토큰 확인 전(공유 안내를 아직 보이지 않음), owner: 본인, guest: 공유 보기
  const [viewer, setViewer] = useState<'unknown' | 'owner' | 'guest'>('unknown');
  const owner = viewer === 'owner';
  const [group, setGroup] = useState<GroupItem | null>(null);
  const [sheet, setSheet] = useState<{ open: boolean; join: boolean; candidateId: number | null }>({
    open: false,
    join: true,
    candidateId: null,
  });
  const id = initial.diagnosis_id;

  useEffect(() => {
    if (!tokenStore.get(id)) {
      setViewer('guest');
      return;
    }
    const ac = new AbortController();
    getDiagnosis(id, ac.signal)
      .then((full) => {
        // 토큰이 맞아야 factory_id 같은 본인 필드가 들어 있다
        if (!('location_source' in full.user_input)) {
          setViewer('guest');
          return;
        }
        setData(full);
        setViewer('owner');
        if (full.user_input.factory_id) {
          getGroup({ diagnosis_id: id }, ac.signal)
            .then((g) => {
              const first = g.groups[0];
              if (first) setGroup(first);
            })
            .catch(() => {
              /* 묶음 카드만 빠진다 */
            });
        }
      })
      .catch((e) => {
        // 공유 보기를 그대로 둔다
        if ((e as { name?: string })?.name !== 'AbortError') setViewer('guest');
      });
    return () => ac.abort();
  }, [id]);

  const openSheet = useCallback(
    (join: boolean, candidateId: number | null = null) => setSheet({ open: true, join, candidateId }),
    [],
  );
  const closeSheet = useCallback(() => setSheet((s) => ({ ...s, open: false })), []);

  const u = data.user_input;
  const chip = u.chip.label;
  const cands = data.candidates;
  const top = cands[0];
  const ansan = data.ansan_candidate ?? null;
  const ansanInTop = ansan?.already_in_top ? ansan.candidate_id : null;
  const ansanCard = ansan && !ansan.already_in_top ? ansan : null;
  const [line1, line2] = summaryLines(u.current_method, cands.length > 0, u.current_processor);
  const canRequest = owner && !!top;
  const sheetCandidate = (sheet.candidateId != null && ansanCard?.candidate_id === sheet.candidateId ? ansanCard : null) ?? top;
  const ansanTag = <Tag tone="basis">{ANSAN_CANDIDATE.tag}</Tag>;

  return (
    <main id="main" className={styles.page}>
      <div className={`container ${styles.wrap}`}>
        <header className={styles.intro}>
          <div className={styles.introTop}>
            <p className={styles.meta}>
              <span>{chip}</span>
              <span>
                월 <span className="count">{num(u.weight_kg_per_month)}</span>kg (직접 입력)
              </span>
              {u.weight_source && <span>{u.weight_source} 기준</span>}
            </p>
            <ShareButton diagnosisId={id} chipLabel={chip} />
          </div>
          <h1 className={styles.headline}>
            <span className={styles.line}>{line1}</span>
            <span className={styles.line}>{line2}</span>
          </h1>
          {data.ranking.inferred_from_reports && (
            <p className={styles.small}>
              처리 방식을 모르셔서 신고에서 가장 많은 방식({data.ranking.current_method_used}) 기준으로 순서를 매겼어요.
            </p>
          )}
        </header>

        <div className={styles.grid}>
          <div className={styles.colMain}>
            <div className={styles.areaRoute}>
              <RouteBar
                chipLabel={chip}
                total={data.current_route.total_reports}
                rows={data.current_route.by_method}
                ownMethod={u.current_method}
              />
            </div>

            <section className={styles.areaCands} aria-labelledby="cands-title">
              <h2 id="cands-title" className={styles.sectionTitle}>
                이웃이 쓰는 재활용 업체{cands.length > 0 && ` ${cands.length}곳`}
              </h2>
              {cands.length === 0 ? (
                <EmptyState title={EMPTY_CANDIDATES.title}>
                  <p>{EMPTY_CANDIDATES.body}</p>
                  <Footnote basis="신고 건수">{SOURCE_REPORTS}</Footnote>
                </EmptyState>
              ) : (
                <div className={styles.cards}>
                  {cands.map((c) => (
                    <ResultCandidate
                      key={c.candidate_id}
                      candidate={c}
                      tags={c.candidate_id === ansanInTop ? ansanTag : undefined}
                      action={
                        c.rank === 1 && canRequest ? (
                          <Button onClick={() => openSheet(true)}>연결 요청</Button>
                        ) : undefined
                      }
                    />
                  ))}
                  <p className={styles.small}>{data.labels.candidates}</p>
                </div>
              )}
              {cands.length > 0 && !ansanInTop && (
                <div className={styles.ansan} aria-labelledby="ansan-title" role="group">
                  <h3 id="ansan-title" className={styles.subTitle}>
                    {ANSAN_CANDIDATE.title}
                  </h3>
                  {ansanCard ? (
                    <>
                      <p className={styles.small}>{ANSAN_CANDIDATE.lead}</p>
                      <ResultCandidate
                        candidate={ansanCard}
                        tags={ansanTag}
                        action={
                          owner ? (
                            <Button variant="secondary" onClick={() => openSheet(true, ansanCard.candidate_id)}>
                              연결 요청
                            </Button>
                          ) : undefined
                        }
                      />
                    </>
                  ) : (
                    <p className={styles.small}>{ANSAN_CANDIDATE.none}</p>
                  )}
                </div>
              )}
              {viewer === 'guest' && cands.length > 0 && (
                <div className={styles.sharedNote}>
                  <p>연결 요청은 진단한 브라우저에서 보낼 수 있어요.</p>
                  <Button href="/diagnose" variant="secondary">
                    우리 공장도 진단하기
                  </Button>
                </div>
              )}
            </section>
          </div>
          <div className={styles.colSide}>
            <section className={styles.areaStats} aria-label="같은 폐기물을 내는 안산 공장">
              <div className={styles.stats}>
                <div className={styles.statItem}>
                  <p className={`${styles.statValue} ${styles.burnText} count`}>{num(data.neighbors.burning)}곳</p>
                  <p className={styles.statLabel}>{neighborsBurnLabel(chip)}</p>
                </div>
                <div className={styles.statItem}>
                  <p className={`${styles.statValue} ${styles.recycleText} count`}>{num(data.neighbors.recycling)}곳</p>
                  <p className={styles.statLabel}>{neighborsRecycleLabel(chip)}</p>
                </div>
              </div>
              <Footnote basis="신고 건수">{SOURCE_REPORTS}, 우리 공장 포함</Footnote>
            </section>

            <div className={styles.areaSide}>
              <ReferencePrices rows={data.reference_prices} userPrice={u.current_price_won_per_ton} />
              {group && <GroupFit group={group} chipLabel={chip} onJoin={canRequest ? () => openSheet(true) : undefined} />}
              <SwitchGuide />
            </div>
          </div>
        </div>
      </div>

      {canRequest && (
        <>
          <div className={styles.stickyBar}>
            <Button size="mobile" onClick={() => openSheet(true)}>
              1순위 업체에 연결 요청
            </Button>
          </div>
          <RequestSheet
            open={sheet.open}
            onClose={closeSheet}
            candidate={sheetCandidate}
            factoryDong={u.factory?.dong ?? null}
            diagnosisId={id}
            chipLabel={chip}
            weightKg={u.weight_kg_per_month}
            joinDefault={sheet.join}
          />
        </>
      )}
    </main>
  );
}
