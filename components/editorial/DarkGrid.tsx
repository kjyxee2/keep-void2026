// 어두운 띠 격자(Figma Editorial/Dark Grid 265:5658): bg/brand를 전체 폭으로 깔고 안쪽 컨테이너에 라벨 + 헤드라인(흰 글자),
// 아래 2열 격자(실제 화면 캡처, 간격 24, 모서리 radius/md), 마지막에 버튼. 위아래 여백 section/gap. 격자 위에는 글자 없음. 페이지 하단 마무리 띠로 한 번만.
import Image, { type StaticImageData } from 'next/image';
import type { ReactNode } from 'react';
import { Row } from './Row';
import styles from './DarkGrid.module.css';

/** position: top은 캡처 위쪽 가운데, center는 사진 가운데, start는 페이지 캡처의 왼쪽 위(왼쪽 여백부터) */
export type DarkGridImage = { src: StaticImageData | string; alt: string; position?: 'top' | 'center' | 'start' };

export function DarkGrid({
  label,
  headline,
  as: Tag = 'h2',
  id,
  images,
  action,
  className,
}: {
  label?: ReactNode;
  headline?: ReactNode;
  as?: 'h2' | 'p';
  id?: string;
  images: DarkGridImage[];
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={[styles.band, className].filter(Boolean).join(' ')}>
      <div className={`editorial-container ${styles.inner}`}>
        {headline !== undefined && (
          <Row label={label} tone="dark" className={styles.head}>
            <Tag id={id} className={styles.headline}>
              {headline}
            </Tag>
          </Row>
        )}
        <ul role="list" className={styles.grid}>
          {images.map((img, i) => (
            <li key={i} className={styles.cell}>
              <Image
                src={img.src}
                alt={img.alt}
                fill
                sizes="(min-width: 1280px) 588px, (min-width: 768px) 50vw, 50vw"
                loading="lazy"
                className={`${styles.image} ${styles[img.position ?? 'top']}`}
              />
            </li>
          ))}
        </ul>
        {action && <div className={styles.action}>{action}</div>}
      </div>
    </div>
  );
}
