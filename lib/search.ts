// 공장 찾기 검색어 → PostgREST or() 필터(순수 함수).
// 값은 큰따옴표로 감싸 쉼표, 괄호, 점, 콜론을 그대로 쓴다(PostgREST 예약 문자). 따옴표 안의 " 와 \ 는 \ 로 이스케이프.
// LIKE 와일드카드 % _ \ 는 글자로 찾도록 \ 로 이스케이프. *는 PostgREST가 %로 바꾸므로 지운다.
const quote = (v: string) => `"${v.replace(/[\\"]/g, m => '\\' + m)}"`;
const like = (v: string) => `%${v.replace(/[\\%_]/g, m => '\\' + m)}%`;

export function factorySearchFilter(raw: string): string | null {
  const q = raw.replace(/[\u0000-\u001f\u007f*]/g, '').replace(/\s+/g, ' ').trim().slice(0, 50);
  if (q.length < 2) return null;
  // 사업장명 표기가 (주)와 ㈜로 섞여 있어 둘 다 찾는다
  const variants = [...new Set([q, q.replaceAll('(주)', '㈜'), q.replaceAll('㈜', '(주)')])];
  return variants.flatMap(v => [`name.ilike.${quote(like(v))}`, `address.ilike.${quote(like(v))}`]).join(',');
}
