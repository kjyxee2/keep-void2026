// 개발용 컴포넌트 목록. production에서는 404
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { UiDemo } from './UiDemo';
import styles from './dev.module.css';

export const metadata: Metadata = { title: '컴포넌트 (개발용)', robots: { index: false } };

export default function DevComponentsPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main id="main" className={`container ${styles.page}`}>
      <h1 className={styles.title}>공용 컴포넌트</h1>
      <p className={styles.lead}>Figma 03 공용 컴포넌트와 1:1로 맞춘 목록이에요. 개발 서버에서만 열려요.</p>
      <UiDemo />
    </main>
  );
}
