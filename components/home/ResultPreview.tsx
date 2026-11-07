// 결과 미리보기(Figma 홈 v2 Section / 결과 미리보기 279:4039 PC, 279:4171 모바일).
// bg/brand 띠 위에 라벨 + "진단하면 / 이렇게 나와요." 흰 글자, 2x2 격자에 실제 화면 캡처(결과, 보고서, 지도, 진단), 아래 서류 사진으로 시작 버튼. 격자 위 글자 없음.
// 캡처는 라이브 화면을 1440 폭으로 찍어 public/photos/strips에 둔 JPEG(가짜 시안 아님).
import { DarkGrid } from '@/components/editorial';
import { Button } from '@/components/ui/Button';
import diagnose from '@/public/photos/strips/diagnose.jpg';
import mapPage from '@/public/photos/strips/map.jpg';
import report from '@/public/photos/strips/report.jpg';
import result from '@/public/photos/strips/result.jpg';
import { ScanIcon } from './icons';
import styles from './ResultPreview.module.css';

export function ResultPreview({ startHref }: { startHref: string }) {
  return (
    <section className={styles.section} aria-labelledby="home-preview-title">
      <DarkGrid
        label="결과 미리보기"
        id="home-preview-title"
        headline={
          <>
            진단하면
            <br />
            이렇게 나와요.
          </>
        }
        images={[
          {
            src: result,
            alt: '진단 결과 화면. 지금은 시흥시의 소각 업체로 보내고 있어요, 같은 폐기물을 원료로 받는 업체가 있어요 제목 아래 안산 공장들이 폐합성수지를 보내는 길 막대와 이웃이 쓰는 재활용 업체 3곳 후보 카드, 공개 처리 단가 원문 표가 있다.',
          },
          {
            src: report,
            alt: '우리 공장 보고서 화면. 우리 공장 탭에 폐기물 폐합성수지, 한 달 무게 2,000kg, 처리 방식 소각, 같은 폐기물 안산 안 처리 31.5%가 지금 경로 표로 적혀 있다.',
          },
          {
            src: mapPage,
            alt: '이웃 공장 지도 화면. 안산 공장 폐기물이 지금 가는 길 제목 아래 배출 공장 1,123곳이 찍힌 지도와 폐기물 종류 선택, 처리업체가 있는 지역 비율 막대가 있다.',
          },
          {
            src: diagnose,
            alt: '1분 진단 1단계 화면. 어떤 폐기물이 나오나요 제목 아래 폐합성수지, 폐수처리오니 등 오니류, 폐활성탄 등 폐흡착제, 폐유 선택 칸과 다음: 무게 입력 버튼이 있다.',
          },
        ]}
        action={
          <Button href={startHref} variant="inverse" className={styles.cta}>
            <span className={styles.ctaLabel}>
              <ScanIcon />
              서류 사진으로 시작
            </span>
          </Button>
        }
      />
    </section>
  );
}
