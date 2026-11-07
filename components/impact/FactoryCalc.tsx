// 우리 공장 계산(Figma 07 기대효과 184:3536). 사용자가 넣은 값끼리만 곱한다. 빈 칸에서 시작하고 공개 단가로 채우지 않는다.
'use client';
import { useState } from 'react';
import { Footnote } from '@/components/ui/Footnote';
import { Input } from '@/components/ui/Input';
import { formatThousands } from '@/lib/home-format';
import { formatWon, monthlyCost, parsePositive, quoteMonthlyDiff } from '@/lib/impact-calc';
import styles from './impact.module.css';

export function FactoryCalc() {
  const [price, setPrice] = useState('');
  const [kg, setKg] = useState('');
  const [quote, setQuote] = useState('');

  const p = parsePositive(price);
  const w = parsePositive(kg);
  const q = parsePositive(quote);
  const cost = monthlyCost(p, w);
  const diff = quoteMonthlyDiff(p, q, w);

  let diffText = '견적을 넣으면 계산돼요';
  if (diff != null) {
    if (diff > 0) diffText = `견적이 한 달 ${formatWon(diff)}원 적어요`;
    else if (diff < 0) diffText = `견적이 한 달 ${formatWon(-diff)}원 많아요`;
    else diffText = '지금과 같아요';
  } else if (q != null && cost == null) {
    diffText = '위 두 칸을 먼저 넣어 주세요';
  }

  return (
    <div className={styles.panel}>
      <div className={styles.pair}>
        <Input
          label="지금 내는 톤당 처리비"
          unit="원/톤"
          inputMode="numeric"
          autoComplete="off"
          placeholder="예: 280,000"
          value={price}
          onChange={(e) => setPrice(formatThousands(e.target.value))}
        />
        <Input
          label="한 달 배출 무게"
          unit="kg"
          inputMode="numeric"
          autoComplete="off"
          placeholder="예: 2,000"
          value={kg}
          onChange={(e) => setKg(formatThousands(e.target.value))}
        />
      </div>

      <div className={styles.outRow}>
        <div className={styles.outLabel}>
          <p className={styles.outName}>지금 한 달 처리비</p>
          <p className={styles.outFormula}>톤당 처리비 × 무게(kg) ÷ 1,000</p>
        </div>
        <output className={cost == null ? styles.outEmpty : styles.outValue} aria-live="polite">
          {cost == null ? '두 값을 넣으면 계산돼요' : `${formatWon(cost)}원`}
        </output>
      </div>

      <Input
        label="업체 견적 톤당 단가"
        unit="원/톤"
        inputMode="numeric"
        autoComplete="off"
        placeholder="예: 250,000"
        helper="견적서를 받은 뒤 넣어 주세요."
        value={quote}
        onChange={(e) => setQuote(formatThousands(e.target.value))}
      />

      <div className={styles.outRow}>
        <div className={styles.outLabel}>
          <p className={styles.outName}>견적과의 한 달 차이</p>
          <p className={styles.outFormula}>(지금 단가 - 견적 단가) × 무게(kg) ÷ 1,000</p>
        </div>
        <output className={diff == null ? styles.outEmpty : styles.outValue} aria-live="polite">
          {diffText}
        </output>
      </div>

      <Footnote basis="직접 입력">이 칸의 계산은 사용자가 넣은 값끼리만 곱합니다. 넣은 값은 저장하지 않습니다.</Footnote>
    </div>
  );
}
