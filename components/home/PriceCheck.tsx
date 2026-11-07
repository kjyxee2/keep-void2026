// 처리비 점검(Figma 홈 v2 Section / 처리비 점검 279:3973 PC, 279:4106 모바일).
// 사진 오프너 → 한 문장 → 입력 칸 + 고시 단가 표(값, 출처 그대로) → 각주 한 줄 → 자세한 기준 보기(기본 닫힘, 긴 설명과 2027 시행 고시).
// 구역에 들어오면 문장, 입력, 표 순으로 나타나고(Reveal) 공개 단가 막대는 화면에 들어올 때 한 번 자란다(ScaleXBar).
// 톤당 금액을 넣으면 "우리 공장" 빈 막대가 그 값만큼 채워진다(사용자 입력 반응, 400ms). 축의 끝은 공개 단가와 입력값 중 가장 큰 값. 차액 계산은 하지 않는다.
'use client';
import { useId, useState } from 'react';
import { AccordionRow, PhotoOpener } from '@/components/editorial';
import { MOTION, Reveal, ScaleXBar } from '@/components/motion';
import { Footnote } from '@/components/ui/Footnote';
import { Input } from '@/components/ui/Input';
import type { HomePriceRow } from '@/lib/home-prices';
import { axisMax, formatThousands, parseWon } from '@/lib/home-format';
import desk from '@/public/photos/sections/s12_desk.jpg';
import styles from './PriceCheck.module.css';

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

export function PriceCheck({ rows }: { rows: HomePriceRow[] }) {
  const [raw, setRaw] = useState('');
  const inputId = useId();
  const mine = parseWon(raw);
  const max = axisMax(rows.map((r) => r.price_won), mine);
  const nextRows = rows.filter((r) => r.next);

  return (
    <section className={styles.section} aria-labelledby="home-price-title">
      <PhotoOpener
        src={desk}
        alt="책상 위 클립보드에 끼운 계량표와 영수증, 계산기, 펜. 창 너머로 창고 선반이 보인다."
        label="처리비 점검"
        id="home-price-title"
        headline={
          <>
            지금 처리비,
            <br />
            공개 단가와 나란히.
          </>
        }
      />
      <div className={`editorial-container ${styles.content}`}>
        <Reveal index={0}>
          <p className={styles.sentence}>톤당 금액을 넣으면 폐합성수지 공개 단가와 비교됩니다.</p>
        </Reveal>
        <div className={styles.compare}>
          <Reveal index={1} className={styles.inputCol}>
            <Input
              id={inputId}
              label="지금 내는 톤당 처리비"
              unit="원/톤"
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
          </Reveal>

          <Reveal index={2} className={styles.table}>
            <ul role="list" className={styles.rows}>
              <li className={styles.row}>
                <div className={styles.label}>
                  <p className={styles.name}>우리 공장</p>
                  <p className={styles.detail}>계약서, 세금계산서의 톤당 금액</p>
                </div>
                <div className={styles.value}>
                  <div className={`${styles.track} ${styles.trackMine}`}>
                    <ScaleXBar ratio={mine ? mine / max : 0} duration={MOTION.emphasis} className={`${styles.bar} ${styles.mine}`} />
                  </div>
                  {mine ? <p className={styles.amount}>{won(mine)}</p> : <p className={styles.direct}>직접 입력</p>}
                </div>
              </li>
              {rows.map((r, i) => (
                <li key={r.id} className={styles.row}>
                  <div className={styles.label}>
                    <p className={styles.name}>{r.label}</p>
                    <p className={styles.detail}>{r.detail}</p>
                  </div>
                  <div className={styles.value}>
                    <div className={styles.track}>
                      <ScaleXBar ratio={r.price_won / max} index={i + 1} duration={MOTION.emphasis} className={`${styles.bar} ${styles[r.tone]}`} />
                    </div>
                    <p className={styles.amount}>{won(r.price_won)}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className={styles.foot}>고시 단가는 보증보험 산출용이며 실제 계약가가 아닙니다.</p>
          </Reveal>
        </div>

        <Reveal index={3}>
          <AccordionRow title="자세한 기준 보기" size="p2">
            <p>
              계약서나 세금계산서의 톤당 금액을 넣으면 같은 폐기물의 공개 단가와 나란히 보여 드려요. 아래는 폐합성수지 기준입니다. 입력한
              금액은 저장하지 않고 무게와 곱하지 않습니다.
            </p>
            {nextRows.length > 0 && (
              <ul role="list" className={styles.nextList}>
                {nextRows.map((r) => (
                  <li key={r.id} className={styles.next}>
                    {r.label}는 {r.next!.year}년부터 {won(r.next!.price_won)}({r.next!.year} 시행 고시)
                  </li>
                ))}
              </ul>
            )}
            <Footnote basis="고시 단가">
              고시 단가는 방치폐기물 보증보험 산출용이며 실제 계약가가 아닙니다. 공제조합, 상장사 단가는 공개 자료 원값입니다.
            </Footnote>
          </AccordionRow>
        </Reveal>
      </div>
    </section>
  );
}
