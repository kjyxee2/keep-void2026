// 헤더: 로고와 메뉴 3개. 모바일은 로고와 메뉴 버튼(시트)
import Link from 'next/link';
import { LogoLockup } from '@/components/brand/Logo';
import { MobileMenu } from './MobileMenu';
import { NavLinks } from './NavLinks';
import styles from './Header.module.css';

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo} aria-label="RE:FIT 홈">
          <LogoLockup size="sm" />
        </Link>
        <nav aria-label="주 메뉴" className={styles.nav}>
          <NavLinks className={styles.links} linkClassName={styles.link} />
        </nav>
        <MobileMenu />
      </div>
    </header>
  );
}
