// 가정 계산기(Figma 07 기대효과 v2 279:3817). 전환율은 보는 사람이 직접 넣는다(기본값 없음, 빈 칸에서 시작).
// 계산식이 헤드라인 자리에 그대로 보이고, 경고 문구는 결과 바로 위에 둔다. 결과는 입력한 뒤에만 보인다. 계산은 lib/impact-calc 그대로.
'use client';
import { useId, useState } from 'react';
import { AccordionRow } from '@/components/editorial';
import { Input } from '@/components/ui/Input';
import { assumedAmount, formatWon, parseRatePct } from '@/lib/impact-calc';
import { LineRows } from './LineRows';
import styles from './impact.module.css';

const n = (v: number) => v.toLocaleString('ko-KR');

export function AssumptionCalc({ tons, diffPerTon, priceYear }: { tons: number; diffPerTon: number; priceYear: number }) {
  const [rate, setRate] = useState('');
  const titleId = useId();
  const r = parseRatePct(rate);
  const amount = assumedAmount(tons, r, diffPerTon);
  const invalid = rate.trim() !== '' && r == null;

  return (
    <section className={styles.assume} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.formula}>
        {n(tons)}톤 × 입력한 전환율 × {n(diffPerTon)}원/톤
      </h2>
      <Input
        label="가정 전환율"
        unit="%"
        inputMode="decimal"
        autoComplete="off"
        value={rate}
        onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))}
        error={invalid ? '0보다 크고 100 이하인 숫자를 넣어 주세요. 소수는 한 자리까지예요.' : undefined}
      />
      <p className={styles.warning}>가정에 따른 계산이며 RE:FIT의 약속이 아닙니다.</p>
      <LineRows
        caption="가정 계산 결과"
        rows={[
          {
            label: '가정 계산 결과',
            strong: true,
            size: 'text',
            value: (
              <output aria-live="polite" className={amount == null ? undefined : 'filled'}>
                {amount == null ? '전환율을 넣으면 보여요' : `한 해 ${formatWon(amount)}원 (가정)`}
              </output>
            ),
          },
        ]}
      />
      <AccordionRow title="자세히 보기">
        <p>
          전환율은 보는 사람이 직접 넣는 가정값입니다. 기본값 없이 빈 칸에서 시작합니다. 계산식: 폐합성수지 위탁소각 톤수(2024 원값) ×
          입력한 전환율 × 고시 단가 차이({priceYear} 적용). 가정에 따른 계산이며 실제 효과나 RE:FIT의 약속이 아닙니다. 결과 칸 이름:
          가정 계산 결과, 전환율을 넣으면 보여요.
        </p>
      </AccordionRow>
    </section>
  );
}
