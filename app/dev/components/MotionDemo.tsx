'use client';
// 모션 확인용. 숫자는 docs/api.md 응답 예(F0001 폐합성수지) 값
import { useState } from 'react';
import { CountUp, Reveal, ScaleXBar, SlideStep } from '@/components/motion';
import { Button } from '@/components/ui/Button';
import { Option } from '@/components/ui/Option';
import styles from './dev.module.css';

const NEIGHBORS = { recycling: { label: '원료 재활용으로 보내는 이웃 공장', value: 139 }, burning: { label: '태워서 처리하는 이웃 공장', value: 486 } };
const BY_METHOD = [
  { method: '소각', pct: 39.1 },
  { method: '중간가공(R10)', pct: 20.6 },
  { method: '물질재활용', pct: 13.5 },
];
const STEPS = ['폐기물 고르기', '무게와 처리 방식', '위치'];

export function MotionDemo() {
  const [key, setKey] = useState<keyof typeof NEIGHBORS>('recycling');
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [replay, setReplay] = useState(0);
  const go = (d: 1 | -1) => {
    setDir(d);
    setStep((s) => Math.min(Math.max(s + d, 0), STEPS.length - 1));
  };

  return (
    <section className={styles.section} aria-label="모션">
      <h2 className={styles.h2}>모션</h2>
      <p className={styles.note}>모션 줄이기를 켜면 모두 바로 최종 상태로 보여요. 스크립트를 꺼도 숫자와 막대는 최종 값이에요.</p>

      <div className={styles.grid2}>
        <div className={styles.stack}>
          <h3 className="text-title-h7">CountUp</h3>
          <fieldset className={styles.row} style={{ border: 0 }}>
            <legend className="sr-only">이웃 공장 기준</legend>
            {(Object.keys(NEIGHBORS) as (keyof typeof NEIGHBORS)[]).map((k) => (
              <Option key={k} name="count-demo" checked={key === k} onChange={() => setKey(k)}>
                {k === 'recycling' ? '재활용' : '소각'}
              </Option>
            ))}
          </fieldset>
          <p className="text-number-numeral">
            <CountUp to={NEIGHBORS[key].value} />
          </p>
          <p className={styles.note}>{NEIGHBORS[key].label}</p>
        </div>

        <div className={styles.stack}>
          <h3 className="text-title-h7">ScaleXBar</h3>
          <div className={styles.stack} key={replay}>
            {BY_METHOD.map((b, i) => (
              <div key={b.method} className={styles.barRow}>
                <span>{b.method}</span>
                <div className={styles.barTrack}>
                  <ScaleXBar ratio={b.pct / 100} index={i} className={styles.barFill} />
                </div>
                <span className="count">{b.pct}%</span>
              </div>
            ))}
          </div>
          <div>
            <Button variant="text" onClick={() => setReplay((r) => r + 1)}>
              다시 재생
            </Button>
          </div>
        </div>
      </div>

      <div className={styles.grid2}>
        <div className={styles.stack}>
          <h3 className="text-title-h7">SlideStep</h3>
          <SlideStep stepKey={step} direction={dir} className={styles.slide}>
            <p className="text-body-p1-bold">
              {step + 1}단계 {STEPS[step]}
            </p>
          </SlideStep>
          <div className={styles.row}>
            <Button variant="secondary" arrow={false} onClick={() => go(-1)} disabled={step === 0}>
              이전
            </Button>
            <Button onClick={() => go(1)} disabled={step === STEPS.length - 1}>
              다음
            </Button>
          </div>
        </div>
        <div className={styles.stack}>
          <h3 className="text-title-h7">Reveal</h3>
          {[0, 1, 2].map((i) => (
            <Reveal key={`${replay}-${i}`} index={i} className={styles.slide}>
              <p>{i + 1}번째 카드가 순서대로 나타나요</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
