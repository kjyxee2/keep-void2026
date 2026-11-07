// 기대효과 페이지의 계산 두 가지. 순수 함수만(화면은 components/impact).
// 1) 우리 공장 계산: 사용자가 넣은 톤당 단가와 kg 무게끼리만 곱한다. 공개 단가나 통계는 쓰지 않는다.
// 2) 가정 계산기: 공식 톤수 x 사용자가 넣은 전환율 x 고시 단가 차이. 전환율은 가정값이고 기본값이 없다.
//    결과는 실제 효과가 아니며 화면 헤드라인과 발표 문장에 쓰지 않는다(계획 2026-11-08 결정).

/** 숫자 칸 입력을 해석한다. 쉼표는 지우고, 0 이하나 숫자가 아니면 null */
export function parsePositive(text: string): number | null {
  const t = text.replace(/,/g, '').trim();
  if (!t || !/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 지금 한 달 처리비(원) = 톤당 처리비(원/톤) x 한 달 무게(kg) / 1,000. 둘 중 하나라도 없으면 null */
export function monthlyCost(pricePerTon: number | null, kg: number | null): number | null {
  if (pricePerTon == null || kg == null) return null;
  return Math.round((pricePerTon * kg) / 1000);
}

/**
 * 견적과의 한 달 차이(원) = (지금 톤당 단가 - 견적 톤당 단가) x 무게(kg) / 1,000.
 * 양수면 견적이 그만큼 싸고, 음수면 견적이 그만큼 비싸다. 셋 중 하나라도 없으면 null
 */
export function quoteMonthlyDiff(pricePerTon: number | null, quotePerTon: number | null, kg: number | null): number | null {
  if (pricePerTon == null || quotePerTon == null || kg == null) return null;
  return Math.round(((pricePerTon - quotePerTon) * kg) / 1000);
}

/** 가정 전환율 입력(%)을 해석한다. 0 초과 100 이하, 소수 한 자리까지. 아니면 null */
export function parseRatePct(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,3}(\.\d)?$/.test(t)) return null;
  const n = Number(t);
  return n > 0 && n <= 100 ? n : null;
}

/**
 * 가정 금액(원/년) = 톤수 x 전환율(%) / 100 x 톤당 단가 차이(원/톤).
 * 전환율이 없으면 null(결과를 그리지 않는다)
 */
export function assumedAmount(tons: number, ratePct: number | null, diffPerTon: number): number | null {
  if (ratePct == null) return null;
  return Math.round((tons * ratePct * diffPerTon) / 100);
}

/** 정수 원 금액을 천 단위 쉼표로. 음수는 앞에 빼기 기호 */
export function formatWon(n: number): string {
  return Math.round(n).toLocaleString('ko-KR');
}
