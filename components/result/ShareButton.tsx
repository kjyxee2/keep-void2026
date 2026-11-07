// 결과 저장: Web Share API가 있으면 공유 시트(카톡 등), 없으면 공유 링크를 복사한다.
// 공유 링크는 토큰 없이 열리므로 공장, 위치, 처리비가 빠진 공유 보기다.
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import styles from './result.module.css';

export function ShareButton({ diagnosisId, chipLabel }: { diagnosisId: string; chipLabel: string }) {
  const [status, setStatus] = useState('');

  async function share() {
    const url = `${window.location.origin}/result/${diagnosisId}`;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (typeof nav.share === 'function') {
      try {
        await nav.share({ title: `RE:FIT ${chipLabel} 진단 결과`, url });
        setStatus('');
        return;
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus('결과 링크를 복사했어요. 공장, 위치, 처리비는 빠진 링크예요');
    } catch {
      setStatus(`이 주소를 복사해 주세요: ${url}`);
    }
  }

  return (
    <div className={styles.share}>
      <Button variant="text" onClick={share}>
        결과 저장
      </Button>
      <p className={styles.shareStatus} role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
