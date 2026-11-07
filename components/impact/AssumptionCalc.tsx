// 가정 계산기(계획 2026-11-08 결정, 방식 C). 전환율은 보는 사람이 직접 넣는다(기본값 없음, 빈 칸에서 시작).
// 계산식을 그대로 보여 주고, 경고 문구를 결과 바로 위에 둔다. 결과는 입력한 뒤에만 보인다.
'use client';
import { useId, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { assumedAmount, formatWon, parseRatePct } from '@/lib/impact-calc';
import styles from './impact.module.css';

export function AssumptionCalc({ tons, diffPerTon, priceYear }: { tons: number; diffPerTon: number; priceYear: number }) {
  const [rate, setRate] = useState('');
  const titleId = useId();
  const r = parseRatePct(rate);
  const amount = assumedAmount(tons, r, diffPerTon);
  const invalid = rate.trim() !== '' && r == null;

  return (
    <section className={styles.calc} aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.calcTitle}>
        가정 계산기
      </h3>
      <p className={styles.calcLead}>전환율은 보는 사람이 직접 넣는 가정값입니다. 기본값 없이 빈 칸에서 시작합니다.</p>
      <Input
        label="가정 전환율"
        unit="%"
        inputMode="decimal"
        autoComplete="off"
        placeholder="빈 칸"
        value={rate}
        onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))}
        error={invalid ? '0보다 크고 100 이하인 숫자를 넣어 주세요. 소수는 한 자리까지예요.' : undefined}
      />
      <div className={styles.formula}>
        <p className={styles.formulaHead}>계산식</p>
        <p className={styles.formulaBody}>
          {tons.toLocaleString('ko-KR')}톤 × 입력 전환율 × {diffPerTon.toLocaleString('ko-KR')}원/톤
        </p>
        <p className={styles.formulaNote}>
          폐합성수지 위탁소각 톤수(2024 원값) × 입력한 전환율 × 고시 단가 차이({priceYear} 적용)
        </p>
      </div>
      <p className={styles.warning}>가정에 따른 계산이며 실제 효과나 RE:FIT의 약속이 아닙니다.</p>
      <p className={styles.result} aria-live="polite">
        <span className={styles.resultLabel}>가정 계산 결과</span>
        {amount == null ? (
          <span className={styles.resultEmpty}>전환율을 넣으면 보여요</span>
        ) : (
          <span className={styles.resultValue}>한 해 {formatWon(amount)}원 (가정)</span>
        )}
      </p>
    </section>
  );
}
