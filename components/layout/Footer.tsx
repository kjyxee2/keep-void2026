// 푸터: 화면 숫자의 출처와 팀 표기
import { Footnote } from '@/components/ui/Footnote';
import { LogoLockup } from '@/components/brand/Logo';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <LogoLockup size="sm" />
          <p className={styles.slogan}>안산에서 나온 자원, 다시 안산으로</p>
        </div>
        <div className={styles.sources}>
          <Footnote basis="신고 건수">안산시 폐기물 배출자 신고현황 2026-07</Footnote>
          <Footnote basis="공식 원값">2024 전국 폐기물 발생 및 처리현황(안산시)</Footnote>
          <Footnote basis="고시 단가">방치폐기물 처리이행보증보험금 산출용 단가</Footnote>
        </div>
        <p className={styles.team}>VOID 2026 해커톤, 팀 한산</p>
      </div>
    </footer>
  );
}
