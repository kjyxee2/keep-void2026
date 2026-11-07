import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import './globals.css';

const pretendard = localFont({
  src: '../public/fonts/PretendardVariable.woff2',
  display: 'swap',
  weight: '45 920',
  variable: '--font-pretendard',
});

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
    <html lang="ko" className={pretendard.variable} suppressHydrationWarning>
      <head>
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
