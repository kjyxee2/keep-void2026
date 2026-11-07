// 단계 블록(Figma Editorial/Step 265:5547, Pages v2 08 기능 설명 278:3662, 278:3737): 큰 번호 + 헤드라인 + 한 문장 + 검증 숫자 하나(Stat) + 이미지(Media Band tall).
// opener가 있으면 사진 오프너 위에 번호와 이름을 두고 문장은 전체 폭. 없으면 번호가 라벨 열(200)에, 이름과 문장이 글 열에.
// side left는 이미지 왼쪽, 글(검증 숫자) 오른쪽. right는 반대. 모바일은 이미지 위, 글 아래 한 열. 상세는 자세히 보기 행 안에(기본 닫힘).
import type { StaticImageData } from 'next/image';
import type { ReactNode } from 'react';
import { AccordionRow } from './AccordionRow';
import { MediaBand } from './MediaBand';
import { PhotoOpener } from './PhotoOpener';
import { Row } from './Row';
import { Stat } from './Stat';
import styles from './Step.module.css';

export type StepProps = {
  number: string;
  name: string;
  sentence: string;
  opener?: { src: StaticImageData | string; alt: string };
  image: { src: StaticImageData | string; alt: string };
  side?: 'left' | 'right';
  stat: { value: string; caption: string; note: string };
  /** 자세히 보기 안의 상세 문장 */
  detail: ReactNode;
  detailTitle?: string;
  id?: string;
};

export function Step({ number, name, sentence, opener, image, side = 'left', stat, detail, detailTitle = '자세히 보기', id }: StepProps) {
  const titleId = id ?? `step-${number}`;
  const srNumber = <span className="sr-only">{Number(number)}단계 </span>;
  return (
    <section className={styles.step} aria-labelledby={titleId}>
      {opener ? (
        <>
          <PhotoOpener
            src={opener.src}
            alt={opener.alt}
            number={number}
            id={titleId}
            headline={
              <>
                {srNumber}
                {name}
              </>
            }
          />
          <div className="editorial-container">
            <Row>
              <p className={styles.sentence}>{sentence}</p>
            </Row>
          </div>
        </>
      ) : (
        <div className="editorial-container">
          <Row label={<span className={styles.number}>{number}</span>}>
            <h2 id={titleId} className={styles.name}>
              {srNumber}
              {name}
            </h2>
            <p className={styles.sentence}>{sentence}</p>
          </Row>
        </div>
      )}
      <div className="editorial-container">
        <div className={`${styles.media} ${side === 'right' ? styles.right : ''}`}>
          <MediaBand src={image.src} alt={image.alt} ratio="tall" sizes="(min-width: 1280px) 588px, (min-width: 768px) 50vw, 100vw" className={styles.image} />
          <Stat value={stat.value} caption={stat.caption} note={stat.note} size="h1" tone="brand" rule="none" className={styles.stat} />
        </div>
      </div>
      <div className="editorial-container">
        <AccordionRow title={detailTitle}>
          <p>{detail}</p>
        </AccordionRow>
      </div>
    </section>
  );
}
