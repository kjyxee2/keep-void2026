-- 홈 칩 통계(결정 2). data/home_waste_stats.json(scripts/home_waste_stats.py 출력)을 scripts/seed.py가 넣는다.
-- 신고 건수 집계만: 칩 신고 원 표기 기준, 1/k 가중, 지역 미확인도 분모에 포함. 추정값 없음.
create table home_waste_stats (
  chip_id text primary key references waste_chips(id),
  name text not null,                       -- 홈 칩 이름(json 키): 폐합성수지, 폐수처리오니, 폐활성탄, 폐유
  reports int not null,                     -- 신고 수(weight 합 = 고유 flow_id 수)
  burn_factories int not null,              -- 소각, 에너지회수 링크가 있는 고유 공장 수
  recycle_factories int not null,           -- 물질재활용 링크가 있는 고유 공장 수
  both_factories int not null,              -- 둘 다 있는 공장 수
  in_ansan_pct double precision,
  outside_gyeonggi_pct double precision,
  region_unknown_pct double precision,
  recycle_pct double precision,
  burn_pct double precision,
  basis text
);
alter table home_waste_stats enable row level security;
create policy read_all on home_waste_stats for select to anon, authenticated using (true);
