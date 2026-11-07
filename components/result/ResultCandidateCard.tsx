// 결과 화면 후보 카드(Figma v2 76:218, 76:248): 순위, 이름, 지역, 이웃 공장 수, 근거 한 줄.
// 카드 안 각주와 확인 태그는 페이지 각주(PAGE_FOOTNOTE)로 옮겨 여기 없다. 모양은 공용 CandidateCard 스타일 그대로.
import type { ReactNode } from 'react';
import { Tag } from '@/components/ui/Tag';
import { candidateEvidence, num } from '@/lib/result-copy';
import type { Candidate } from '@/lib/types';
import styles from '@/components/ui/CandidateCard.module.css';

export function ResultCandidateCard({ candidate: c, tags, action }: { candidate: Candidate; tags?: ReactNode; action?: ReactNode }) {
  const ranked = c.rank > 0;
  const recommended = c.rank === 1;
  const headingId = `cand-${c.candidate_id}`;
  return (
    <article className={[styles.card, recommended && styles.recommended].filter(Boolean).join(' ')} aria-labelledby={headingId}>
      <div className={styles.top}>
        {ranked && (
          <p className={styles.rank}>
            <span className="sr-only">추천 </span>
            {String(c.rank).padStart(2, '0')}
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
            {c.name}
          </h3>
          <p className={styles.meta}>
            <span>{c.sigungu ?? '지역 정보 없음'}</span>
          </p>
        </div>
        <p className={styles.metric}>
          <span className={`${styles.neighbors} count`}>{num(c.neighbors)}</span>
          <span className={styles.neighborsLabel}>이웃 공장</span>
        </p>
      </div>
      <div className={styles.evidence}>
        <p className={styles.evidenceText}>{candidateEvidence(c.neighbors)}</p>
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </article>
  );
}
