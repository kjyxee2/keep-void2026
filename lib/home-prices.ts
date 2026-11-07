// 홈 처리비 점검(Figma 106:673, 106:732): 폐합성수지 칩의 공개 단가 행. unit_prices 원문 값만 읽는다(읽기 전용).
// 고시 단가는 무게와 곱하지 않고, 입력한 톤당 금액과 나란히 놓기만 한다(docs/api.md 화면 규칙).
// 순수 함수와 타입만(서버 읽기는 lib/home-data.ts)

export type HomePriceRow = {
  /** 큰 숫자로 보이는 행의 unit_prices id */
  id: string;
  /** 화면 이름(Figma 문구) */
  label: string;
  /** 기준 시점과 조건(Figma 문구). 2022 행이 없어 2027 값을 쓰면 "2027 시행" */
  detail: string;
  /** 지금 적용되는 값. 막대도 이 값으로만 그린다(같은 시점끼리 비교) */
  price_won: number;
  year: number;
  /** 같은 항목의 다음 고시(2027 시행). 보조 줄 글자로만 보인다 */
  next: { id: string; price_won: number; year: number } | null;
  /** 막대 색 토큰 이름. 색만으로 뜻을 전하지 않도록 이름과 금액 글자가 항상 같이 보인다 */
  tone: 'burn' | 'recycle' | 'landfill' | 'factory';
};

/** 폐합성수지(C01) 공개 단가 id. lib/fit.ts referencePriceIds(C01)와 같은 목록 */
export const HOME_PRICE_IDS = ['U001', 'U060', 'U035', 'U096', 'U161', 'U176'] as const;

type Id = (typeof HOME_PRICE_IDS)[number];

/** 화면 한 줄: 같은 항목의 2022 적용분(current)과 2027 시행분(next)을 합친다. 화면 순서 */
const ROWS: { current: Id; next?: Id; label: string; detail: string; tone: HomePriceRow['tone'] }[] = [
  { current: 'U001', next: 'U060', label: '정부 고시 처분업자 단가', detail: '2022 적용', tone: 'burn' },
  { current: 'U035', next: 'U096', label: '정부 고시 재활용업자 단가', detail: '2022 적용', tone: 'recycle' },
  { current: 'U161', label: '공제조합 소각처리단가 (일반)', detail: '2021, 부가세 별도', tone: 'landfill' },
  { current: 'U176', label: '상장 처리업체 평균 소각단가', detail: '코엔텍 2023년 1분기, 울산 1개사', tone: 'factory' },
];

// DB를 못 읽을 때만 쓰는 같은 행의 원문 값(unit_prices, 2026-11-08 확인). 추정값 아님
export const HOME_PRICE_SNAPSHOT: Record<string, { price_won: number; year: number }> = {
  U001: { price_won: 297000, year: 2022 },
  U060: { price_won: 316000, year: 2027 },
  U035: { price_won: 269000, year: 2022 },
  U096: { price_won: 287000, year: 2027 },
  U161: { price_won: 260000, year: 2021 },
  U176: { price_won: 144000, year: 2023 },
};

export function toPriceRows(rows: { id: string; price_won: number; year: number }[]): HomePriceRow[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ROWS.flatMap(({ current, next, label, detail, tone }): HomePriceRow[] => {
    const cur = byId.get(current);
    const nxt = next ? byId.get(next) : undefined;
    if (cur) {
      return [{ id: current, label, detail, tone, price_won: cur.price_won, year: cur.year,
        next: nxt && next ? { id: next, price_won: nxt.price_won, year: nxt.year } : null }];
    }
    // 2022 행이 없고 2027 행만 있으면 그 값을 큰 숫자로, "2027 시행" 표시
    if (nxt && next) return [{ id: next, label, detail: `${nxt.year} 시행`, tone, price_won: nxt.price_won, year: nxt.year, next: null }];
    return [];
  });
}
