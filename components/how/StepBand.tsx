// 기능 설명 단계 띠(Figma 08 기능 설명 186:3716 PC, 187:4464 모바일).
// 카드 나열 대신 굵은 윗선과 번호로 나눈 세로 띠. 단계마다 이름, 한 줄, 검증 숫자 하나와 정의, 출처, 실제 화면 한 장. 정지 화면(연출 없음)
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Footnote } from '@/components/ui/Footnote';
import type { HowStep } from '@/lib/how-steps';
import styles from './StepBand.module.css';

export function StepBand({ steps }: { steps: HowStep[] }) {
  return (
    <ol role="list" className={styles.band}>
      {steps.map(step => (
        <StepItem key={step.no} step={step} />
      ))}
    </ol>
  );
}

function StepItem({ step }: { step: HowStep }) {
  const titleId = `how-step-${step.no}`;
  return (
    <li className={styles.step} aria-labelledby={titleId}>
      <p className={styles.no} aria-hidden="true">
        {step.no}
      </p>
      <div className={styles.body}>
        <h2 id={titleId} className={styles.name}>
          <span className="sr-only">{Number(step.no)}단계 </span>
          {step.name}
        </h2>
        <p className={styles.line}>{step.line}</p>
        <div className={styles.verify}>
          <p className={styles.value}>{step.value}</p>
          <p className={styles.definition}>{step.definition}</p>
          {step.notes?.map(n => (
            <p key={n} className={styles.note}>
              {n}
            </p>
          ))}
          {step.source.basis ? (
            <Footnote basis={step.source.basis} className={styles.source}>
              {step.source.text}
            </Footnote>
          ) : (
            <p className={`${styles.source} ${styles.plainSource}`}>{step.source.text}</p>
          )}
        </div>
        <ul role="list" className={styles.links}>
          {step.links.map(l => (
            <li key={l.href + l.label}>
              <Button href={l.href} variant="text" className={styles.link}>
                {l.label}
              </Button>
            </li>
          ))}
        </ul>
      </div>
      <figure className={styles.screen}>
        <div className={styles.frame}>
          <Image
            src={step.screen.src}
            alt={step.screen.alt}
            width={960}
            height={600}
            sizes="(min-width: 1024px) 480px, (min-width: 768px) 80vw, 100vw"
            className={styles.image}
          />
        </div>
        <figcaption className={styles.caption}>{step.screen.caption}</figcaption>
      </figure>
    </li>
  );
}
