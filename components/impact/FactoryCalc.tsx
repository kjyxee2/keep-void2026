// 우리 공장 계산(Figma 07 기대효과 v2 279:3762). 사용자가 넣은 값끼리만 곱한다. 빈 칸에서 시작하고 공개 단가로 채우지 않는다.
// 톤당 처리비와 배출 무게 두 칸, 아래 한 달 처리비 한 줄. 업체 견적 칸과 견적과의 차이 행은 자세히 보기 안에(계산 로직은 lib/impact-calc 그대로).
'use client';
import { useState } from 'react';
import { AccordionRow } from '@/components/editorial';
import { Input } from '@/components/ui/Input';
import { formatThousands } from '@/lib/home-format';
import { formatWon, monthlyCost, parsePositive, quoteMonthlyDiff } from '@/lib/impact-calc';
import { LineRows } from './LineRows';
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
    <div className={styles.content}>
      <div className={styles.inputs}>
        <Input
          label="톤당 처리비"
          unit="원/톤"
          inputMode="numeric"
          autoComplete="off"
          placeholder="280,000"
          value={price}
          onChange={(e) => setPrice(formatThousands(e.target.value))}
        />
        <Input
          label="배출 무게"
          unit="kg"
          inputMode="numeric"
          autoComplete="off"
          placeholder="2,000"
          value={kg}
          onChange={(e) => setKg(formatThousands(e.target.value))}
        />
      </div>
      <LineRows
        caption="한 달 처리비"
        rows={[
          {
            label: '한 달 처리비',
            strong: true,
            size: 'text',
            value: (
              <output aria-live="polite" className={cost == null ? undefined : 'filled'}>
                {cost == null ? '넣으면 계산돼요' : `${formatWon(cost)}원`}
              </output>
            ),
          },
        ]}
      />
      <AccordionRow title="자세히 보기">
        <p>
          계약서나 세금계산서의 톤당 금액과 계량표의 무게를 넣으면 지금 한 달 처리비가 나옵니다. 업체 견적을 받으면 그 금액과 나란히
          비교합니다. 견적과의 한 달 차이 = (지금 단가 - 견적 단가) × 무게(kg) ÷ 1,000. 이 칸의 계산은 사용자가 넣은 값끼리만
          곱합니다. 출처 (직접 입력).
        </p>
        <div className={styles.quote}>
          <Input
            label="업체 견적 톤당 단가"
            unit="원/톤"
            inputMode="numeric"
            autoComplete="off"
            placeholder="250,000"
            value={quote}
            onChange={(e) => setQuote(formatThousands(e.target.value))}
          />
          <LineRows
            caption="견적과의 한 달 차이"
            rows={[
              {
                label: '견적과의 한 달 차이',
                strong: true,
                size: 'text',
                value: (
                  <output aria-live="polite" className={diff == null ? undefined : 'filled'}>
                    {diffText}
                  </output>
                ),
              },
            ]}
          />
        </div>
      </AccordionRow>
    </div>
  );
}
