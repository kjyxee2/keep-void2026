// 처리비 점검(Figma Price Check 106:673 PC, 106:732 모바일).
// 공개 단가 막대가 이 화면의 유일한 자동 연출(ScaleXBar, 화면에 들어올 때 한 번).
// 톤당 금액을 넣으면 "우리 공장" 빈 막대가 그 값만큼 채워진다(사용자 입력 반응, 400ms).
// 축의 끝은 공개 단가와 입력값 중 가장 큰 값. 차액, 절감액 같은 계산은 하지 않는다.
'use client';
import { useId, useState } from 'react';
import { Footnote } from '@/components/ui/Footnote';
import { Input } from '@/components/ui/Input';
import type { HomePriceRow } from '@/lib/home-prices';
import { axisMax, formatThousands, parseWon } from '@/lib/home-format';
import { PriceBar } from './PriceBar';
import styles from './PriceCheck.module.css';

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

export function PriceCheck({ rows }: { rows: HomePriceRow[] }) {
  const [raw, setRaw] = useState('');
  const inputId = useId();
  const mine = parseWon(raw);
  const max = axisMax(rows.map((r) => r.price_won), mine);

  return (
    <section className={styles.section} aria-labelledby="home-price-title">
      <div className={`container ${styles.layout}`}>
        <div className={styles.intro}>
          <h2 id="home-price-title" className={styles.title}>
            지금 처리비,
            <br />
            공개된 기준과 비교해 보세요.
          </h2>
          <p className={styles.lead}>
            계약서나 세금계산서의 톤당 금액을 넣으면 같은 폐기물의 공개 단가와 나란히 보여 드려요. 아래는 폐합성수지
            기준입니다.
          </p>
          <Input
            id={inputId}
            label="지금 내는 톤당 처리비"
            unit="원 / 톤"
            inputMode="numeric"
            autoComplete="off"
            placeholder="예: 280,000"
            value={raw}
            onChange={(e) => setRaw(formatThousands(e.target.value))}
            aria-describedby={`${inputId}-note`}
          />
          <p id={`${inputId}-note`} className="sr-only">
            입력한 금액은 저장하지 않고, 아래 표의 우리 공장 막대로만 보여 드려요.
          </p>
        </div>

        <div className={styles.table}>
          <ul role="list" className={styles.rows}>
            <li className={styles.row}>
              <div className={styles.label}>
                <p className={styles.name}>우리 공장</p>
                <p className={styles.detail}>계약서, 세금계산서의 톤당 금액</p>
              </div>
              <div className={styles.value}>
                <div className={`${styles.track} ${styles.trackMine}`}>
                  <PriceBar ratio={mine ? mine / max : 0} className={`${styles.bar} ${styles.mine}`} />
                </div>
                {mine ? (
                  <p className={styles.amount}>{won(mine)}</p>
                ) : (
                  <p className={styles.direct}>직접 입력</p>
                )}
              </div>
            </li>
            {rows.map((r, i) => (
              <li key={r.id} className={styles.row}>
                <div className={styles.label}>
                  <p className={styles.name}>{r.label}</p>
                  <p className={styles.detail}>{r.detail}</p>
                  {r.next && (
                    <p className={styles.next}>
                      {r.next.year}년부터 {won(r.next.price_won)}({r.next.year} 시행 고시)
                    </p>
                  )}
                </div>
                <div className={styles.value}>
                  <div className={styles.track}>
                    <PriceBar ratio={r.price_won / max} index={i + 1} className={`${styles.bar} ${styles[r.tone]}`} />
                  </div>
                  <p className={styles.amount}>{won(r.price_won)}</p>
                </div>
              </li>
            ))}
          </ul>
          <Footnote basis="고시 단가" className={styles.foot}>
            고시 단가는 방치폐기물 보증보험 산출용이며 실제 계약가가 아닙니다. 공제조합, 상장사 단가는 공개 자료
            원값입니다.
          </Footnote>
        </div>
      </div>
    </section>
  );
}
