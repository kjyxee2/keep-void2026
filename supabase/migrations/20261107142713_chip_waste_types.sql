-- 칩 집계 기준: 결과 화면(경로 분포, 이웃 공장 수)을 홈 칩 통계와 같은 신고 원 표기(flows.waste_type)로 센다.
-- C01 폐합성수지 '폐합성수지류(폐염화비닐수지류는 제외한다)', C02 '폐수처리오니', C03 '폐활성탄',
-- 나머지 칩은 그 폐기물군의 원 표기 전부(폐유 = 폐유 묶음 전체). 값은 scripts/seed.py가 data/chip_waste_types.json에서 넣는다.
-- null이면 서버는 폐기물군 전체로 센다(시드 전 호환).
alter table waste_chips add column waste_types text[];
comment on column waste_chips.waste_types is '결과 집계에 쓰는 flows.waste_type 목록(신고 원 표기). data/chip_waste_types.json';
