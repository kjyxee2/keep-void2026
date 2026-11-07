// 기능 설명(/how, Figma 05 Pages v2 "08 기능 설명 v2" PC 186:3696, 모바일 187:4464):
// 머리(라벨 열 + 헤드라인 + 한 문장 + 지도 띠), 8단계 띠, 캡처 2열 격자(어두운 띠, 글자 없음), 출처 각주 한 줄. 정지 화면(자동 연출 없음)
import type { Metadata } from 'next';
import { DarkGrid, MediaBand, SectionHead } from '@/components/editorial';
import { HowSteps } from '@/components/how/HowSteps';
import { Footnote } from '@/components/ui/Footnote';
import { HOW_CAPTURES, HOW_INTRO_IMAGE, HOW_STEPS } from '@/lib/how-steps';
import styles from './how.module.css';

export const metadata: Metadata = {
  title: '기능 설명 | RE:FIT',
  description: '서류 사진 자동 입력부터 이웃 공장 지도까지, RE:FIT 각 단계에 쓰는 기술과 검증 숫자, 출처를 함께 보여 드려요.',
};

export default function HowPage() {
  return (
    <main id="main" className={styles.main}>
      <div className={`editorial-container ${styles.intro}`}>
        <SectionHead
          as="h1"
          id="how-title"
          label="기능 설명"
          headline={
            <>
              사진 한 장에서 보낼 곳까지,
              <br className={styles.br} /> 각 단계에 쓰는 기술과 근거.
            </>
          }
          sentence="단계마다 실제 화면과 검증 숫자 하나를 함께 둡니다."
        />
        <MediaBand src={HOW_INTRO_IMAGE.src} alt={HOW_INTRO_IMAGE.alt} ratio="intro" />
      </div>
      <HowSteps steps={HOW_STEPS} />
      <DarkGrid images={HOW_CAPTURES} className={styles.captures} />
      <div className={`editorial-container ${styles.foot}`}>
        <Footnote basis="신고 건수">안산시 배출자 신고현황 2026-07, 환경부 고시 처리단가 2022 (실제 계약가 아님)</Footnote>
      </div>
    </main>
  );
}
