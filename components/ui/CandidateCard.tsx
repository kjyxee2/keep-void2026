// Figma Candidate Card(71:118): Recommended(1위, 강조 테두리, 연결 요청) / Collapsed(2, 3위)
// 숫자는 API 값 그대로(neighbors). note 문구는 반드시 보인다.
// 슬롯: evidence(근거 한 줄, 없으면 칩 이름으로 만든 기본 문구), reasons(추천 이유 목록), tags(이름 위 Tag), meta(지역, 방식 뒤 글자)
import type { ReactNode } from 'react';
import { Footnote } from './Footnote';
import { Tag } from './Tag';
import styles from './CandidateCard.module.css';

/** 받침 있으면 "을", 없으면 "를" */
export function objectParticle(word: string) {
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return '를';
  return (last - 0xac00) % 28 ? '을' : '를';
}

export function CandidateCard({
  rank,
  name,
  region,
  methodLabel = '원료 재활용 (허가 업종 기준)',
  meta,
  neighbors,
  wasteLabel,
  evidence,
  reasons,
  reasonsLabel = '추천 이유',
  tags,
  note,
  source = '안산시 폐기물 배출자 신고현황 2026-07',
  variant = rank === 1 ? 'recommended' : 'collapsed',
  action,
  headingId,
}: {
  /** 추천 순위. 없거나 0이면 순위 숫자를 그리지 않는다(예: 안산 안 후보) */
  rank?: number | null;
  name: string;
  /** 시군 이름(API sigungu) */
  region: string;
  methodLabel?: string;
  /** 지역, 방식 뒤에 붙는 글자(예: 직선거리) */
  meta?: ReactNode[];
  neighbors: number;
  /** 칩 이름(예: 폐합성수지). evidence가 없을 때 기본 근거 문구에 쓴다 */
  wasteLabel?: string;
  /** 근거 한 줄. 없으면 "같은 {칩}을 이 업체에 원료 재활용으로 보내는 안산 공장 N곳" */
  evidence?: ReactNode;
  /** 추천 이유(API reasons[].text). 주면 이유 라벨을 보이고, 비어 있으면 목록만 그리지 않는다 */
  reasons?: string[];
  reasonsLabel?: string;
  /** 이름 위 Tag(가장 추천 Tag 옆). 예: <Tag>안산 안 업체</Tag> */
  tags?: ReactNode;
  /** API candidates[].note 원문 */
  note: string;
  source?: string;
  variant?: 'recommended' | 'collapsed';
  /** 연결 요청 버튼 */
  action?: ReactNode;
  /** 제목 id(카드 aria-labelledby) */
  headingId?: string;
}) {
  const recommended = variant === 'recommended';
  const ranked = typeof rank === 'number' && rank > 0;
  const evidenceLine =
    evidence ??
    (wasteLabel ? (
      <>
        같은 {wasteLabel}
        {objectParticle(wasteLabel)} 이 업체에 원료 재활용으로 보내는 안산 공장 {neighbors.toLocaleString('ko-KR')}곳
      </>
    ) : null);
  const list = (reasons ?? []).filter(Boolean);
  return (
    <article
      className={[styles.card, recommended && styles.recommended].filter(Boolean).join(' ')}
      aria-labelledby={headingId}
    >
      <div className={styles.top}>
        {ranked && (
          <p className={styles.rank}>
            <span className="sr-only">추천 </span>
            {String(rank).padStart(2, '0')}
            <span className="sr-only">위</span>
          </p>
        )}
        <div className={styles.body}>
          {(recommended || tags) && (
            <div className={styles.tags}>
              {recommended && <Tag tone="recommend">가장 추천</Tag>}
              {tags}
            </div>
          )}
          <h3 id={headingId} className={styles.name}>
            {name}
          </h3>
          <p className={styles.meta}>
            <span>{region}</span>
            <span>{methodLabel}</span>
            {meta?.map((m, i) => <span key={i}>{m}</span>)}
          </p>
        </div>
        <p className={styles.metric}>
          <span className={`${styles.neighbors} count`}>{neighbors.toLocaleString('ko-KR')}</span>
          <span className={styles.neighborsLabel}>이웃 공장</span>
        </p>
      </div>
      <div className={styles.evidence}>
        {reasons && <p className={styles.reasonLabel}>{reasonsLabel}</p>}
        {evidenceLine && <p className={styles.evidenceText}>{evidenceLine}</p>}
        {list.length > 0 && (
          <ul role="list" className={styles.reasonList}>
            {list.map((r, i) => (
              <li key={i} className={styles.evidenceText}>
                {r}
              </li>
            ))}
          </ul>
        )}
        <Footnote basis="신고 건수">{source}</Footnote>
      </div>
      <div className={action ? styles.action : styles.note}>
        <span className={styles.noteText}>
          <Tag tone="warning">{note}</Tag>
        </span>
        {action}
      </div>
    </article>
  );
}
