// 공개 단가 표: API reference_prices 행을 모두 원문 그대로(무게와 곱하지 않음).
// 고시 2022 적용분과 2027 시행분은 item, method 원문이 같을 때만 한 줄로 묶고 2027 값은 아래 작은 줄에 적는다.
// 사용자가 넣은 톤당 단가가 있으면 같은 단위(원/톤)로 옆에 한 줄 더 둔다(계산 없음).
// 주의 문장과 행별 출처는 "자세히 보기" 접힘 안(Figma v2 76:290). 고시 출처는 페이지 각주에도 있다.
'use client';
import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { mergeNoticeYears, num } from '@/lib/result-copy';
import type { ReferencePrice } from '@/lib/types';
import { Disclosure } from './Disclosure';
import styles from './result.module.css';

const MAX_PRICE = 1_000_000_000;

export function ReferencePrices({ rows, userPrice }: { rows: ReferencePrice[]; userPrice: number | null | undefined }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const inputId = useId();
  const typed = Number(draft.replace(/,/g, ''));
  const typedOk = draft !== '' && Number.isInteger(typed) && typed >= 0 && typed <= MAX_PRICE;
  const error = draft !== '' && !typedOk ? '0 이상 10억 이하 숫자로 넣어 주세요' : undefined;
  // 펼치면 입력 칸으로 초점을 옮긴다
  useEffect(() => {
    if (open) document.getElementById(inputId)?.focus();
  }, [open, inputId]);
  const mine = typedOk ? typed : (userPrice ?? null);

  // 같은 고시 항목(category, item, method 원문 일치)의 2022 적용분과 2027 시행분은 한 줄. 큰 숫자는 지금 적용되는 2022 값
  const merged = mergeNoticeYears(rows);
  const sources = [...new Set(rows.map((r) => r.source).filter(Boolean))] as string[];
  const notes = [...new Set(rows.map((r) => r.note).filter(Boolean))] as string[];

  return (
    <section className={styles.panel} aria-labelledby="prices-title">
      <h2 id="prices-title" className={styles.panelTitle}>
        참고: 공개 처리 단가 원문
      </h2>
      {rows.length === 0 ? (
        <p className={styles.panelBody}>이 폐기물에 맞는 고시 단가 행이 없어요.</p>
      ) : (
        // 좁은 화면에서 옆으로 밀리는 표: 키보드로도 스크롤할 수 있게 초점을 받는다
        <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="공개 단가 표">
          <table className={styles.table}>
            <caption className="sr-only">공개 처리 단가. 실제 계약가가 아니며 무게와 곱하지 않아요</caption>
            <thead>
              <tr>
                <th scope="col">품목과 방식</th>
                <th scope="col">톤당 단가</th>
                <th scope="col">기준</th>
              </tr>
            </thead>
            <tbody>
              {merged.map(({ main: r, next }) => (
                <tr key={r.id}>
                  <th scope="row">
                    <span className={styles.cellMain}>{r.item}</span>
                    <span className={styles.cellSub}>
                      {r.method}, {r.category}
                    </span>
                    {next && (
                      <span className={`${styles.cellNext} count`}>
                        2027년부터 {num(next.price_won)}원(2027 시행 고시)
                      </span>
                    )}
                  </th>
                  <td className="count">
                    {num(r.price_won)}
                    <span className={styles.cellSub}>{r.unit}</span>
                  </td>
                  <td>{r.year_label ?? `${r.year}년`}</td>
                </tr>
              ))}
              {mine != null && (
                <tr className={styles.mineRow}>
                  <th scope="row">
                    <span className={styles.cellMain}>우리 단가</span>
                    <span className={styles.cellSub}>{typedOk ? '이 화면에서 넣은 값' : '진단 때 넣은 값'}</span>
                  </th>
                  <td className="count">
                    {num(mine)}
                    <span className={styles.cellSub}>원/톤</span>
                  </td>
                  <td>직접 입력</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <Disclosure>
        <p className={styles.panelBody}>
          실제 계약 단가는 업체마다 다릅니다. RE:FIT은 예상 절감액을 계산하지 않고, 연결 후 업체 견적으로 확인합니다.
        </p>
        {merged.some(({ main }) => main.year_label === '2027 시행') && <p className={styles.small}>2027 시행 값은 아직 시행 전이에요.</p>}
        {notes.length > 0 && (
          <ul role="list" className={styles.noteList}>
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        {sources.length > 0 && (
          <ul role="list" className={styles.noteList} aria-label="출처">
            {sources.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        )}
      </Disclosure>
      {open ? (
        <div className={`${styles.priceInput} expand-content`}>
          <Input
            id={inputId}
            label="지금 내는 톤당 단가"
            unit="원/톤"
            inputMode="numeric"
            autoComplete="off"
            value={draft}
            onChange={(e) => {
              const d = e.target.value.replace(/[^\d]/g, '');
              setDraft(d ? Number(d).toLocaleString('ko-KR') : '');
            }}
            helper="저장하지 않아요. 표에 나란히 놓고 보기만 해요"
            error={error}
          />
        </div>
      ) : (
        <div className={styles.linkRow}>
          <Button variant="text" onClick={() => setOpen(true)}>
            우리 단가 넣고 비교하기
          </Button>
        </div>
      )}
    </section>
  );
}
