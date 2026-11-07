// 푸터: 팀 표기와 한 줄 출처. 자세한 출처는 숫자가 있는 화면마다(Footnote) 붙어 있어 여기서는 되풀이하지 않는다
import Link from 'next/link';
import { LogoLockup } from '@/components/brand/Logo';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Link href="/" className={styles.logo} aria-label="RE:FIT 홈">
            <LogoLockup size="sm" />
          </Link>
          <p className={styles.slogan}>안산에서 나온 자원, 다시 안산으로</p>
        </div>
        <p className={styles.sources}>
          숫자의 출처는 각 화면에 적었어요. 안산시 폐기물 배출자 신고현황, 환경부 전국 폐기물 발생 및 처리현황 2024, 환경부 고시 처리단가.
        </p>
        <p className={styles.team}>VOID 2026 해커톤, 팀 한산</p>
      </div>
    </footer>
  );
}
