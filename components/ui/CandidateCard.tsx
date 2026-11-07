// Figma Candidate Card(71:118): Recommended(1위, 강조 테두리, 연결 요청) / Collapsed(2, 3위)
// 숫자는 API 값 그대로(neighbors). note 문구는 반드시 보인다
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
  neighbors,
  wasteLabel,
  note,
  source = '안산시 폐기물 배출자 신고현황 2026-07',
  variant = rank === 1 ? 'recommended' : 'collapsed',
  action,
}: {
  rank: number;
  name: string;
  /** 시군 이름(API sigungu) */
  region: string;
  methodLabel?: string;
  neighbors: number;
  /** 칩 이름(예: 폐합성수지) */
  wasteLabel: string;
  /** API candidates[].note 원문 */
  note: string;
  source?: string;
  variant?: 'recommended' | 'collapsed';
  /** 연결 요청 버튼(Recommended에만) */
  action?: ReactNode;
}) {
  const recommended = variant === 'recommended';
  return (
    <article className={[styles.card, recommended && styles.recommended].filter(Boolean).join(' ')}>
      <div className={styles.top}>
        <p className={styles.rank} aria-label={`${rank}위`}>
          {String(rank).padStart(2, '0')}
        </p>
        <div className={styles.body}>
          {recommended && <Tag tone="recommend">가장 추천</Tag>}
          <h3 className={styles.name}>{name}</h3>
          <p className={styles.meta}>
            <span>{region}</span>
            <span>{methodLabel}</span>
          </p>
        </div>
        <p className={styles.metric}>
          <span className={`${styles.neighbors} count`}>{neighbors.toLocaleString('ko-KR')}</span>
          <span className={styles.neighborsLabel}>이웃 공장</span>
        </p>
      </div>
      <div className={styles.evidence}>
        <p className={styles.evidenceText}>
          같은 {wasteLabel}
          {objectParticle(wasteLabel)} 이 업체에 원료 재활용으로 보내는 안산 공장 {neighbors.toLocaleString('ko-KR')}곳
        </p>
        <Footnote basis="신고 건수">{source}</Footnote>
      </div>
      {recommended ? (
        <div className={styles.action}>
          <Tag tone="warning">{note}</Tag>
          {action}
        </div>
      ) : (
        <div className={styles.note}>
          <Tag tone="warning">{note}</Tag>
        </div>
      )}
    </article>
  );
}
