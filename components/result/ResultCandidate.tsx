// 결과 화면 후보 카드. 공용 CandidateCard(Figma 71:118)와 같은 모양과 CSS를 쓰고,
// 근거 문구만 결과 화면 규칙("같은 폐기물군을 이 업체에 재활용으로 보내는 안산 공장 N곳")으로 바꾼다.
// 공용 컴포넌트에 evidence 문구 슬롯이 생기면 그것으로 바꾼다.
import type { ReactNode } from 'react';
import { Footnote } from '@/components/ui/Footnote';
import { Tag } from '@/components/ui/Tag';
import styles from '@/components/ui/CandidateCard.module.css';
import { SOURCE_REPORTS, candidateEvidence, num } from '@/lib/result-copy';
import type { Candidate } from '@/lib/types';
import local from './result.module.css';

/** 추천 이유(나중에 API가 줄 수 있음). 공용 types.ts Candidate에 들어가기 전까지 여기서 optional로 둔다 */
export type CandidateReason = { type: string; text: string; count?: number };
type CandidateWithReasons = Candidate & { reasons?: CandidateReason[] };

export function ResultCandidate({ candidate, action }: { candidate: CandidateWithReasons; action?: ReactNode }) {
  const reasons = Array.isArray(candidate.reasons) ? candidate.reasons.filter((r) => r && typeof r.text === 'string' && r.text) : [];
  const recommended = candidate.rank === 1;
  const region = candidate.sigungu ?? '지역 정보 없음';
  return (
    <article
      className={[styles.card, recommended && styles.recommended].filter(Boolean).join(' ')}
      aria-labelledby={`cand-${candidate.candidate_id}`}
    >
      <div className={styles.top}>
        <p className={styles.rank}>
          <span className="sr-only">추천 </span>
          {String(candidate.rank).padStart(2, '0')}
          <span className="sr-only">위</span>
        </p>
        <div className={styles.body}>
          {recommended && <Tag tone="recommend">가장 추천</Tag>}
          <h3 id={`cand-${candidate.candidate_id}`} className={styles.name}>
            {candidate.name}
          </h3>
          <p className={styles.meta}>
            <span>{region}</span>
            <span>원료 재활용 (허가 업종 기준)</span>
            <span>{candidate.distance_km == null ? '거리 정보 없음' : `직선 ${candidate.distance_km}km`}</span>
          </p>
        </div>
        <p className={styles.metric}>
          <span className={`${styles.neighbors} count`}>{num(candidate.neighbors)}</span>
          <span className={styles.neighborsLabel}>이웃 공장</span>
        </p>
      </div>
      <div className={styles.evidence}>
        <p className={local.reasonLabel}>추천 이유</p>
        <p className={styles.evidenceText}>{candidateEvidence(candidate.neighbors)}</p>
        {reasons.length > 0 && (
          <ul role="list" className={local.reasonList}>
            {reasons.map((r, i) => (
              <li key={`${r.type}-${i}`} className={styles.evidenceText}>
                {r.text}
              </li>
            ))}
          </ul>
        )}
        <Footnote basis="신고 건수">{SOURCE_REPORTS}</Footnote>
      </div>
      <div className={recommended ? styles.action : styles.note}>
        <span className={local.noteText}>
          <Tag tone="warning">{candidate.note}</Tag>
        </span>
        {action}
      </div>
    </article>
  );
}
