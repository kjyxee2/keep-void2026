// 이미지 띠(Figma Editorial/Media Band 265:5491): 실제 화면 캡처나 사진만, 글자 금지.
// ratio wide는 가로 띠(1200x400), intro는 머리 띠(1200x420), tall은 단계 이미지 열(588x368). 테두리 1px border/default, 모서리 radius/md.
import Image, { type StaticImageData } from 'next/image';
import styles from './MediaBand.module.css';

export function MediaBand({
  src,
  alt,
  ratio = 'wide',
  position = 'top',
  sizes = '(min-width: 1280px) 1200px, 100vw',
  className,
}: {
  src: StaticImageData | string;
  alt: string;
  ratio?: 'wide' | 'intro' | 'tall';
  /** 캡처는 위쪽을, 사진은 가운데를 보인다 */
  position?: 'top' | 'center';
  sizes?: string;
  className?: string;
}) {
  return (
    <div className={[styles.band, styles[ratio], className].filter(Boolean).join(' ')}>
      <Image src={src} alt={alt} fill sizes={sizes} loading="lazy" className={`${styles.image} ${styles[position]}`} />
    </div>
  );
}
