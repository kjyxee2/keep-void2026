// 결과 미리보기(Figma Result Preview 121:706 PC, 121:737 모바일).
// 값은 docs/api.md의 실제 진단 응답 예(F0001 성곡동, 폐합성수지)의 1위 후보 그대로. 정지 화면(연출 없음)
import { Button } from '@/components/ui/Button';
import { CandidateCard } from '@/components/ui/CandidateCard';
import styles from './ResultPreview.module.css';

/** docs/api.md POST /api/diagnoses/:id/complete 응답 예 candidates[0] (F0001, 폐합성수지) */
export const PREVIEW_EXAMPLE = {
  factoryId: 'F0001',
  dong: '성곡동',
  waste: '폐합성수지',
  candidate: { rank: 1, name: '(주)거단산업', sido: '경기', sigungu: '평택시', neighbors: 28 },
} as const;

export function ResultPreview({ startHref }: { startHref: string }) {
  const { candidate: c } = PREVIEW_EXAMPLE;
  const exampleHref = `/diagnose?factory=${PREVIEW_EXAMPLE.factoryId}`;
  return (
    <section className={styles.section} aria-labelledby="home-preview-title">
      <div className={`container ${styles.inner}`}>
        <div className={styles.head}>
          <h2 id="home-preview-title" className={styles.title}>
            진단하면 이렇게 나와요
          </h2>
          <p className={styles.note}>
            {PREVIEW_EXAMPLE.dong} {PREVIEW_EXAMPLE.waste} 공장 예시입니다.
          </p>
        </div>
        <div className={styles.card}>
          <CandidateCard
            rank={c.rank}
            name={c.name}
            region={`${c.sido} ${c.sigungu}`}
            neighbors={c.neighbors}
            wasteLabel={PREVIEW_EXAMPLE.waste}
            note="실제 처리 가능 여부는 업체 확인 필요"
            action={
              <Button href={startHref} size="pc" className={styles.action}>
                연결 요청
              </Button>
            }
          />
        </div>
        <Button href={exampleHref} variant="text" className={styles.more}>
          전체 결과 예시 보기
        </Button>
      </div>
    </section>
  );
}
