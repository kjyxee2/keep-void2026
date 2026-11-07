// 푸터: 왼쪽에 로고(헤더보다 한 단계 큼)와 슬로건, 오른쪽에 사이트 구조 3열(서비스, 알아보기, 자료).
// 아래 줄은 팀 표기 한 줄과 "숫자 출처는 각 화면 아래에 표시" 한 줄. 자세한 출처는 숫자가 있는 화면마다(Footnote) 붙어 있어 여기서는 되풀이하지 않는다.
import Link from 'next/link';
import { LogoLockup } from '@/components/brand/Logo';
import styles from './Footer.module.css';

type FooterLink = { href: string; label: string; external?: boolean };

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: '서비스',
    links: [
      { href: '/diagnose?start=photo', label: '서류 사진으로 시작' },
      { href: '/diagnose', label: '보낼 곳 찾기' },
      { href: '/map', label: '이웃 공장 지도' },
      { href: '/report', label: '우리 공장 보고서' },
    ],
  },
  {
    title: '알아보기',
    links: [
      { href: '/impact', label: '기대효과' },
      { href: '/how', label: '기능 설명' },
      // /how 7단계 제목(components/how/StepBand.tsx의 how-step-<no>)
      { href: '/how#how-step-07', label: '업체 바꾸는 절차' },
    ],
  },
  {
    title: '자료',
    links: [
      // /impact 맨 아래 출처 묶음(가정 계산 구역)
      { href: '/impact#impact-assume', label: '데이터 출처' },
      // 지도 타일 저작권 표기 의무
      { href: 'https://www.openstreetmap.org/copyright', label: 'OpenStreetMap 기여자', external: true },
    ],
  },
];

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Link href="/" className={styles.logo} aria-label="RE:FIT 홈">
            <LogoLockup size="md" />
          </Link>
          <p className={styles.slogan}>안산에서 나온 자원, 다시 안산으로.</p>
        </div>
        <nav aria-label="사이트 구조" className={styles.columns}>
          {COLUMNS.map((col) => (
            <div key={col.title} className={styles.column}>
              <p className={styles.colTitle}>{col.title}</p>
              <ul role="list" className={styles.list}>
                {col.links.map((l) => (
                  <li key={l.href}>
                    {l.external ? (
                      <a href={l.href} className={styles.link} rel="noopener noreferrer" target="_blank">
                        {l.label}
                        <span className="sr-only"> (새 창)</span>
                      </a>
                    ) : (
                      <Link href={l.href} className={styles.link}>
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className={styles.bottom}>
          <p className={styles.team}>
            RE:FIT, 임수원, 당현송, 최윤형, 이경준
            <a className={styles.void} href="https://hyvoid.kr/" target="_blank" rel="noopener noreferrer" aria-label="VOID 2026 해커톤 (새 창)">
              {/* VOID 2026 워드마크(hyvoid.kr 공개 에셋, currentColor로 글자색과 맞춤) */}
              <img src="/brand/partners/void-wordmark.svg" alt="VOID 2026" width="1364" height="224" />
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
