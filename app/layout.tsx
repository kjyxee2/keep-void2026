import type { Metadata, Viewport } from 'next';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import './globals.css';

// 글꼴은 styles/fonts.css의 Pretendard 동적 서브셋(unicode-range 92조각). 화면에 쓰인 글자가 든 조각만 내려받는다.
// 첫 화면 제목에 가장 많이 쓰이는 두 조각(90: 자주 쓰는 한글, 91: 라틴 글자와 숫자)만 먼저 받는다.
const PRELOAD_FONTS = ['/fonts/pretendard/PretendardVariable.subset.90.woff2', '/fonts/pretendard/PretendardVariable.subset.91.woff2'];

export const metadata: Metadata = {
  title: 'RE:FIT',
  description: '안산에서 나온 자원, 다시 안산으로. 우리 공장 폐기물이 어디로 가는지 신고 자료로 확인하세요.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {PRELOAD_FONTS.map((href) => (
          <link key={href} rel="preload" as="font" type="font/woff2" href={href} crossOrigin="anonymous" />
        ))}
        {/* 모션 숨김 상태는 스크립트가 있을 때만(styles/motion.css .js) */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>
        {/* 스크립트가 꺼져 있으면 모션 초기 상태(0, 투명) 대신 최종 상태를 보여 준다 */}
        <noscript>
          <style>{'[data-motion-bar]{transform:scaleX(var(--ratio))!important}[data-motion-reveal]{opacity:1!important;transform:none!important}'}</style>
        </noscript>
        <a href="#main" className="skip-link">
          본문으로 건너뛰기
        </a>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
