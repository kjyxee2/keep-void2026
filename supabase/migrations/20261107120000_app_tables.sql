-- 앱 데이터(쓰기). 명세 v0.1 2-3 "앱 데이터 테이블" SQL 그대로 + 아래 "명세 외 추가" + 2-6 RLS
-- 비회원 쓰기는 Route Handler(서비스 키, RLS 우회)에서 anon_token 확인 후 처리. 아래 정책은 클라이언트 직접 접근 한도.

-- ── 명세 2-3 그대로 ────────────────────────────────
create extension if not exists pgcrypto;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'factory' check (role in ('factory','buyer','city','operator','processor')),
  factory_id text references factories(id),       -- 신고 공장과 연결(선택)
  processor_id text references processors(id),    -- 처리업체 계정일 때
  created_at timestamptz not null default now()
);

-- 비회원 진단: anon_token을 브라우저에 저장, 로그인하면 user_id로 연결
create table diagnoses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  anon_token text,                               -- 비회원 식별(서버에서 발급, 해시 저장 권장)
  factory_id text references factories(id),      -- 신고 공장을 골랐을 때
  chip_id text references waste_chips(id),
  waste_group text,
  volume_option_id text references volume_options(id),
  tons_per_year numeric,                         -- 서버 계산값(마대 x 무게 x 12)
  current_method text check (current_method in ('소각','매립','에너지회수','모름')),
  lat double precision, lng double precision, location_source text, -- '주소','현재위치','신고공장'
  status text not null default 'draft' check (status in ('draft','completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- 결과 스냅샷: 계산 당시 단가와 후보를 그대로 저장(나중에 단가가 바뀌어도 재현 가능)
create table diagnosis_results (
  diagnosis_id uuid primary key references diagnoses(id) on delete cascade,
  scenario text not null default '기준',
  current_unit_price int,                        -- 원/톤
  recycle_unit_price int,
  current_cost_year int,                         -- 원
  recycle_cost_year int,
  saving_year int,
  monthly_cost int,
  price_source jsonb,                            -- unit_prices id 목록
  is_estimate boolean not null default true,
  created_at timestamptz not null default now()
);

create table diagnosis_candidates (
  id bigint generated always as identity primary key,
  diagnosis_id uuid not null references diagnoses(id) on delete cascade,
  rank int not null check (rank between 1 and 3),
  processor_id text not null references processors(id),
  fit_score numeric not null,
  evidence_rows int,                              -- 이웃 공장 수(사회적 증거)
  distance_km numeric,
  distance_quality text,
  candidate_confirmed boolean,
  source text not null default 'fit_candidates'   -- 'fit_candidates' 또는 'computed'
);

create table connection_requests (
  id uuid primary key default gen_random_uuid(),
  diagnosis_id uuid not null references diagnoses(id),
  candidate_id bigint references diagnosis_candidates(id),
  processor_id text not null references processors(id),
  user_id uuid references auth.users(id),
  anon_token text,
  contact_name text, contact_phone text,          -- 개인정보: 운영자와 해당 처리업체만 조회
  kakao_notify boolean not null default true,
  join_group boolean not null default true,       -- 공동 수거 기본 ON(옵트아웃)
  status text not null default 'requested'
    check (status in ('requested','contacted','sample','contracted','first_pickup','cancelled','rejected')),
  sla_due_at timestamptz,                         -- 영업일 2일 뒤(서버 계산)
  created_at timestamptz not null default now()
);

create table request_events (                      -- 내 공장 타임라인
  id bigint generated always as identity primary key,
  request_id uuid not null references connection_requests(id) on delete cascade,
  status text not null,
  note text,
  actor text not null check (actor in ('user','operator','processor','system')),
  created_at timestamptz not null default now()
);

create table group_memberships (                   -- GROUP FIT 참여 신청
  id bigint generated always as identity primary key,
  group_id text not null references group_fit(group_id),
  diagnosis_id uuid references diagnoses(id),
  user_id uuid references auth.users(id),
  status text not null default 'joined' check (status in ('joined','left')),
  created_at timestamptz not null default now(),
  unique (group_id, diagnosis_id)
);

-- P2: 원료 찾기
create table demand_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  company_name text not null,
  waste_group text not null,
  conditions jsonb,                               -- 성분, 오염도, 형상, 최소 물량
  monthly_tons numeric,
  lat double precision, lng double precision,
  created_at timestamptz not null default now()
);

-- 퍼널 KPI용 이벤트(PRD 2장 지표)
create table events (
  id bigint generated always as identity primary key,
  anon_token text, user_id uuid,
  name text not null,                              -- 'home_view','diag_start','diag_step','diag_complete','request_submit'
  props jsonb,
  created_at timestamptz not null default now()
);

create index on diagnoses (anon_token); create index on diagnoses (user_id);
create index on connection_requests (processor_id, status);
create index on events (name, created_at);

-- ── 명세 외 추가 ────────────────────────────────────
alter table diagnosis_candidates add unique (diagnosis_id, rank);
create index on connection_requests (user_id);
create index on request_events (request_id);

-- 정책 안에서 profiles를 읽으면 RLS 재귀가 나므로 security definer로 우회
create or replace function my_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function my_processor_id() returns text
language sql stable security definer set search_path = '' as $$
  select processor_id from public.profiles where id = auth.uid() and role = 'processor'
$$;

-- 가입 시 profiles 자동 생성. role은 항상 기본값 factory, 승격은 서비스 키만
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'name');
  return new;
end $$;
revoke execute on function handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ── RLS (명세 2-6) ─────────────────────────────────
-- anon 정책은 하나도 없음 = 비회원은 서버 경유만
alter table profiles             enable row level security;
alter table diagnoses            enable row level security;
alter table diagnosis_results    enable row level security;
alter table diagnosis_candidates enable row level security;
alter table connection_requests  enable row level security;
alter table request_events       enable row level security;
alter table group_memberships    enable row level security;
alter table demand_listings      enable row level security;
alter table events               enable row level security;

-- profiles: 본인 읽기, display_name만 수정(role, factory_id, processor_id 승격 차단)
create policy own_select on profiles for select to authenticated
  using (id = (select auth.uid()) or (select my_role()) = 'operator');
create policy own_update on profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on profiles from anon, authenticated;
grant update (display_name) on profiles to authenticated;

-- 진단: 본인 select, update / 운영자 전체 / 처리업체 없음
create policy own_select on diagnoses for select to authenticated
  using (user_id = (select auth.uid()));
create policy own_update on diagnoses for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy operator_all on diagnoses for all to authenticated
  using ((select my_role()) = 'operator') with check ((select my_role()) = 'operator');

-- 결과, 후보: 서버 계산값이라 사용자는 select만(명세의 update는 diagnoses에만 적용)
create policy own_select on diagnosis_results for select to authenticated
  using (exists (select 1 from diagnoses d where d.id = diagnosis_id and d.user_id = (select auth.uid())));
create policy operator_all on diagnosis_results for all to authenticated
  using ((select my_role()) = 'operator') with check ((select my_role()) = 'operator');
create policy own_select on diagnosis_candidates for select to authenticated
  using (exists (select 1 from diagnoses d where d.id = diagnosis_id and d.user_id = (select auth.uid())));
create policy operator_all on diagnosis_candidates for all to authenticated
  using ((select my_role()) = 'operator') with check ((select my_role()) = 'operator');

-- 연결 요청: 본인 select / 운영자 전체 / 자기 processor_id 요청 select와 status 수정
create policy visible on connection_requests for select to authenticated
  using (user_id = (select auth.uid()) or processor_id = (select my_processor_id()));
create policy operator_all on connection_requests for all to authenticated
  using ((select my_role()) = 'operator') with check ((select my_role()) = 'operator');
create policy processor_status on connection_requests for update to authenticated
  using (processor_id = (select my_processor_id()))
  with check (processor_id = (select my_processor_id()));
revoke update on connection_requests from anon, authenticated;
grant update (status) on connection_requests to authenticated;

create policy visible on request_events for select to authenticated
  using (exists (select 1 from connection_requests r where r.id = request_id
    and (r.user_id = (select auth.uid()) or r.processor_id = (select my_processor_id()))));
create policy operator_all on request_events for all to authenticated
  using ((select my_role()) = 'operator') with check ((select my_role()) = 'operator');

-- 공동 수거 참여, 원료 찾기: 본인 것 / 운영자 전체
create policy own on group_memberships for all to authenticated
  using (user_id = (select auth.uid()) or (select my_role()) = 'operator')
  with check (user_id = (select auth.uid()) or (select my_role()) = 'operator');
create policy own on demand_listings for all to authenticated
  using (user_id = (select auth.uid()) or (select my_role()) = 'operator')
  with check (user_id = (select auth.uid()) or (select my_role()) = 'operator');

-- 이벤트: 로그인 사용자 insert(본인 id만), 운영자 select
create policy insert_own on events for insert to authenticated
  with check (user_id is null or user_id = (select auth.uid()));
create policy operator_read on events for select to authenticated
  using ((select my_role()) = 'operator');
