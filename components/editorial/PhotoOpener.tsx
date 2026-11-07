// 사진 오프너(Figma Editorial/Photo Opener 278:3640): 전체 폭 사진(560, 모바일 420) 왼쪽 아래에 라벨과 두 줄 헤드라인(흰 글자).
// 글자 뒤 아래쪽에만 bg/brand 그라데이션(0%에서 55%, 글자 띠에서는 더 진하게 올려 4.5:1을 지킨다). 사진 위 글자는 라벨과 헤드라인만.
// 사진은 next/image fill, sizes 100vw, lazy. 섹션당 한 장.
import Image, { type StaticImageData } from 'next/image';
import type { ReactNode } from 'react';
import styles from './PhotoOpener.module.css';

export function PhotoOpener({
  src,
  alt,
  label,
  number,
  headline,
  as: Tag = 'h2',
  id,
  scale = 'h2',
  priority = false,
  className,
}: {
  src: StaticImageData | string;
  alt: string;
  /** 섹션 라벨(P3, sentence case) */
  label?: ReactNode;
  /** 단계 번호(Display 42 Bold). 라벨 대신 쓴다 */
  number?: ReactNode;
  headline: ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'p';
  id?: string;
  /** editorial: Editorial/Headline 56/32, h2: Pages v2 H2 40/H5 26 */
  scale?: 'editorial' | 'h2';
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={[styles.opener, className].filter(Boolean).join(' ')}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="100vw"
        priority={priority}
        loading={priority ? undefined : 'lazy'}
        className={styles.photo}
      />
      <div className={styles.shade} aria-hidden="true" />
      <div className={`editorial-container ${styles.copy}`}>
        {number !== undefined && <p className={styles.number}>{number}</p>}
        {label !== undefined && <p className={styles.label}>{label}</p>}
        <Tag id={id} className={`${styles.headline} ${styles[scale]}`}>
          {headline}
        </Tag>
      </div>
    </div>
  );
}
