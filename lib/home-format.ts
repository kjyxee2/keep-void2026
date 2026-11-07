// 홈 처리비 점검 입력과 막대 축. 금액 계산(차액, 절감액)은 하지 않는다. 축은 막대 길이를 정하는 데만 쓴다.

/** 숫자만 남겨 천 단위 쉼표를 붙인다. 앞의 0은 지운다. 최대 10자리(백억 원 미만) */
export function formatThousands(input: string): string {
  const digits = input.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 10);
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 쉼표 글자를 정수 원으로. 비었거나 0이면 null */
export function parseWon(text: string): number | null {
  const n = Number(text.replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 막대 축의 끝: 공개 단가와 입력값 중 가장 큰 값(그 막대가 칸을 꽉 채움). 값이 없으면 1 */
export function axisMax(prices: number[], mine: number | null): number {
  return Math.max(...prices, mine ?? 0, 1);
}
