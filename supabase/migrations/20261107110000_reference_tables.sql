-- 참고 데이터(읽기 전용, 시드). 출처: data/demo/README.md 3절 CREATE TABLE 그대로 + 명세 2-3 추가 참고 테이블
-- 쓰기는 시드 스크립트(서비스 키)만. 클라이언트는 select만.

-- ── demo/README.md 그대로 ───────────────────────────
create table factories (
  id text primary key, name text not null, address text, dong text,
  lat double precision, lng double precision, coord_source text,
  waste_types jsonb, waste_groups jsonb, n_waste_types int, n_processors int, n_flows int,
  sheets jsonb, small_emitter_proxy boolean
);
create table processors (
  id text primary key, name text not null, name_variants jsonb, sido text, sigungu text, address text,
  lat double precision, lng double precision, coord_source text, business_type text,
  method text, methods_2026 jsonb, permit_summary text, r_types text, r_types_by_group text,
  incinerator_ton_per_day double precision, landfill_m3 double precision, capacity text,
  confirmed boolean, confirm_status text, flows_2026 double precision, n_factories_2026 int
);
create table flows (
  link_id int primary key, flow_id int not null, period text, sheet text,
  factory_id text references factories(id), processor_id text references processors(id),
  processor_name_raw text, transporter text, transporter_is_processor boolean,
  waste_type text, waste_group text, method text, method_detail text, method_by_other_group_permit boolean,
  in_ansan boolean, region text, region_w1 text, distance_km double precision, distance_quality text,
  weight double precision
);
create table fit_candidates (
  id bigint generated always as identity primary key,
  factory_id text references factories(id), factory_name text, waste_group text,
  current_processor_id text references processors(id), current_processor_name text, current_method text,
  candidate_processor_id text references processors(id), candidate_name text, candidate_sigungu text,
  rank int, evidence_rows int, distance_km double precision, distance_quality text,
  candidate_confirmed boolean, factory_already_recycles_group boolean, fit_score double precision
);
create table group_fit (
  group_id text primary key, waste_group text, factory_ids jsonb, n int,
  centroid_lat double precision, centroid_lng double precision, max_dist_km double precision,
  dongs jsonb, current_methods jsonb, shared_processor_ids jsonb, n_distinct_processors int
);
create table unit_prices (
  id text primary key, category text, item text, waste_group text, method text, scenario text,
  price_won double precision, price_min double precision, price_max double precision, unit text,
  year int, source_code text, source text, source_nature text, note text
);
create index on flows (factory_id); create index on flows (processor_id); create index on flows (waste_group);
create index on fit_candidates (factory_id, waste_group, rank);

-- ── summary.json 1행 (명세 2-3 "app_summary: jsonb 1행") ──
create table app_summary (
  id int primary key default 1 check (id = 1),
  data jsonb not null
);

-- ── 명세 2-3 추가 참고 테이블 그대로 ────────────────────
-- 진단 화면의 품목 칩과 폐기물군 매핑, 마대 환산 기본값
create table waste_chips (
  id text primary key,                 -- 'plastic', 'sludge', 'carbon', 'oil', 'unknown'
  label text not null,                 -- '폐합성수지(플라스틱)'
  waste_group text,                    -- flows.waste_group 값과 같게 (예: '폐합성수지류')
  bag_kg int not null,                 -- 마대 1개 기본 무게(추정, 품목별로 팀이 정함)
  sort int not null default 0
);

-- 물량 5지선다 기본값
create table volume_options (
  id text primary key,                 -- 'v1'~'v5'
  label text not null,                 -- '한 달에 마대 1~2개'
  bags_per_month numeric not null,     -- 대표값
  is_default boolean not null default false
);

-- ── 거리 함수 (명세 2-3 그대로, search_path만 고정) ─────
create or replace function haversine_km(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns float8 language sql immutable set search_path = '' as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

-- ── RLS (명세 2-6): anon, authenticated select만 ─────────
do $$
declare t text;
begin
  foreach t in array array['factories','processors','flows','fit_candidates','group_fit','unit_prices',
                           'app_summary','waste_chips','volume_options'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy read_all on %I for select to anon, authenticated using (true)', t);
  end loop;
end $$;
