-- 사용자가 넣는 톤당 처리 단가(원/톤, 결정 3). 공개 단가와 나란히 보여 주기만 하고 계산에 쓰지 않는다.
alter table diagnoses
  add column current_price_won_per_ton integer check (current_price_won_per_ton >= 0);
comment on column diagnoses.current_price_won_per_ton is '사용자 입력 톤당 처리 단가(원/톤). 비교 표시용, 서버 계산에 쓰지 않음';
grant update (current_price_won_per_ton) on diagnoses to authenticated;
