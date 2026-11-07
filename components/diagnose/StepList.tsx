// 진단 왼쪽 단계 목록(PC). 지금 단계는 aria-current="step"과 왼쪽 막대, 끝난 단계는 고른 값을 글자로 보여 준다
import type { Step } from '@/lib/diagnose-state';
import styles from './Diagnose.module.css';

export type StepListItem = {
  step: Step;
  title: string;
  /** 지금 단계일 때 */
  current: string;
  /** 끝난 단계일 때 고른 값. 없으면 기본 설명 */
  done: string | null;
  /** 아직 안 온 단계 설명 */
  idle: string;
};

export function StepList({ items, step }: { items: StepListItem[]; step: Step }) {
  return (
    <ol className={styles.stepList} aria-label="진단 단계">
      {items.map((it) => {
        const state = it.step === step ? 'current' : it.step < step ? 'done' : 'idle';
        const sub = state === 'current' ? it.current : state === 'done' ? (it.done ?? it.idle) : it.idle;
        return (
          <li
            key={it.step}
            className={styles.stepItem}
            data-state={state}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span className={styles.stepNo}>{String(it.step).padStart(2, '0')}</span>
            <span className={styles.stepText}>
              <span className={styles.stepTitle}>{it.title}</span>
              <span className={styles.stepSub} data-filled={state === 'done' && it.done ? '' : undefined}>
                {sub}
                {state === 'done' && <span className="sr-only">, 끝남</span>}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
