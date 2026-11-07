// 기능 설명(/how): 사진 한 장에서 보낼 곳까지 8단계와 단계별 검증 숫자. 정지 화면(자동 연출 없음)
import type { Metadata } from 'next';
import { StepBand } from '@/components/how/StepBand';
import { HOW_STEPS } from '@/lib/how-steps';
import styles from './how.module.css';

export const metadata: Metadata = {
  title: '기능 설명 | RE:FIT',
  description: '서류 사진 자동 입력부터 이웃 공장 지도까지, RE:FIT 각 단계에 쓰는 기술과 검증 숫자, 출처를 함께 보여 드려요.',
};

export default function HowPage() {
  return (
    <main id="main" className={styles.main}>
      <div className="container">
        <header className={styles.intro}>
          <h1 className={styles.title}>
            사진 한 장에서 보낼 곳까지,
            <br className={styles.br} /> 각 단계에 쓰는 기술과 근거.
          </h1>
          <p className={styles.lead}>
            단계마다 실제 화면과 검증 숫자 하나를 함께 둡니다. 숫자 아래에는 무엇을 센 값인지 적었습니다.
          </p>
        </header>
        <StepBand steps={HOW_STEPS} />
      </div>
    </main>
  );
}
