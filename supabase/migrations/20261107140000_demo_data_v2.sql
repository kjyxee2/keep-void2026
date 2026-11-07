-- 데모 데이터 v2 (커밋 4d8c270): 공개 원값, 신고 건수 집계, 사용자 입력만 사용.
-- 가정 단가, 시나리오, 마대 환산, 대리지표, 서버 계산 금액은 모두 제거.
-- 참고 테이블 열은 data/demo/README.md 3절 CREATE TABLE과 같게 맞춘다.

-- ── 참고 테이블: README v2와 같게 ─────────────────────
alter table factories drop column small_emitter_proxy;
alter table factories add column coord_verified boolean;
alter table processors add column coord_verified boolean;

alter table unit_prices drop column scenario;
alter table unit_prices add column source_file text, add column source_location text;

-- waste_chips, volume_options는 diagnoses가 FK로 참조하므로 다시 만들지 않고 열만 바꾼다(RLS 정책 유지)
alter table waste_chips drop column bag_kg, drop column sort;
alter table waste_chips
  add column container text,
  add column container_volume_l double precision,
  add column bulk_density_t_m3 double precision,
  add column fill_ratio double precision,
  add column unit_kg double precision,
  add column basis text,
  add column source text,
  add column source_url text,
  add column display_text text;

alter table volume_options drop column bags_per_month, drop column is_default;
alter table volume_options
  add column min_count int,
  add column max_count int,
  add column representative_count int,
  add column note text;

-- ── 진단 입력: 용기 개수 대신 사용자가 넣는 월 무게 ─────────
-- volume_option_id는 남김: README "용기 개수는 참고 정보로만 저장"
alter table diagnoses drop column tons_per_year;
alter table diagnoses
  add column weight_kg_per_month numeric check (weight_kg_per_month > 0),
  add column weight_source text check (weight_source in ('계량표','올바로 인계서','기타')),
  add column current_cost_won_per_month bigint check (current_cost_won_per_month >= 0);  -- 청구서 처리비(선택)
grant update (weight_kg_per_month, weight_source, current_cost_won_per_month) on diagnoses to authenticated;

-- ── 결과 스냅샷: 금액 계산 열 삭제, 신고 근거 열 추가 ─────────
alter table diagnosis_results
  drop column scenario,
  drop column current_unit_price,
  drop column recycle_unit_price,
  drop column current_cost_year,
  drop column recycle_cost_year,
  drop column saving_year,
  drop column monthly_cost,
  drop column price_source,
  drop column is_estimate;
alter table diagnosis_results
  add column neighbors_recycling int,            -- 같은 폐기물군을 물질재활용으로 보내는 안산 공장 수(신고 건수 집계)
  add column neighbors_burning int,              -- 같은 폐기물군을 소각, 에너지회수로 보내는 안산 공장 수
  add column reference_price_ids jsonb,          -- 보여 준 unit_prices.id 목록(원문 단가, 무게와 곱하지 않음)
  add column data_version text;                  -- 시드한 데모 데이터 버전(예: 커밋 4d8c270)
