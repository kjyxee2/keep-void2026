// 모바일 하단 고정 버튼(Figma Sticky CTA 75:125). 사진 우선 변경(2026-11-07)으로 문구는 "서류 사진으로 시작".
// 히어로의 같은 버튼이나 푸터가 화면에 보이는 동안은 아래로 내려 숨긴다(스크롤 반응, transform만). 스크립트가 없으면 늘 보인다.
'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ScanIcon } from './icons';
import styles from './StickyCta.module.css';

export function StickyCta({ href, watchId }: { href: string; watchId: string }) {
  // null: 아직 관찰 전(처음 화면은 히어로가 보이므로 숨긴 상태로 시작해 깜빡임이 없다)
  const [hidden, setHidden] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setHidden(false);
      return;
    }
    const targets = [document.getElementById(watchId), document.querySelector('body > footer, footer')].filter(
      (el): el is HTMLElement => el instanceof HTMLElement,
    );
    if (!targets.length) {
      setHidden(false);
      return;
    }
    const seen = new Map<Element, boolean>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target, e.isIntersecting);
      setHidden([...seen.values()].some(Boolean));
    });
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [watchId]);

  return (
    <div className={styles.bar} data-hidden={hidden !== false || undefined} inert={hidden === true || undefined}>
      <Button href={href} size="mobile" className={styles.button}>
        <span className={styles.label}>
          <ScanIcon />
          서류 사진으로 시작
        </span>
      </Button>
    </div>
  );
}
