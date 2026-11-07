// 업체 바꾸는 절차(Figma v2 130:1299 접힘이 기본). 5단계, 지정폐기물, 출처, 안내 모두 접힘 안에 있고
// "5단계 보기" 글자 버튼으로 연다(Disclosure: 높이 즉시, 내용만 250ms, 줄임 모드 0ms).
import { Footnote } from '@/components/ui/Footnote';
import { SWITCH_GUIDE as G } from '@/lib/result-copy';
import { Disclosure } from './Disclosure';
import styles from './result.module.css';

export function SwitchGuide() {
  return (
    <section className={styles.panel} aria-labelledby="guide-title">
      <h2 id="guide-title" className={styles.panelTitle}>
        {G.title}
      </h2>
      <p className={styles.panelBody}>{G.lead}</p>
      <Disclosure label={`${G.steps.length}단계 보기`}>
        <ol role="list" className={styles.steps}>
          {G.steps.map((s, i) => (
            <li key={s.title} className={styles.step}>
              <span className={`${styles.stepNo} count`}>{String(i + 1).padStart(2, '0')}</span>
              <div>
                <p className={styles.stepTitle}>{s.title}</p>
                <p className={styles.stepBody}>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className={styles.designated}>
          <p className={styles.stepTitle}>{G.designated.title}</p>
          <p className={styles.stepBody}>{G.designated.body}</p>
        </div>
        <Footnote basis="법령, 지침 원문">{G.source}</Footnote>
        <p className={styles.small}>{G.disclaimer}</p>
      </Disclosure>
    </section>
  );
}
