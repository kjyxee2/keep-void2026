-- 지금 맡기는 처리업체(서류 사진에서 읽거나 사용자가 적은 값). 결과 계산(순위, 점수)에는 쓰지 않고
-- 결과 요약의 "지금은 {지역}의 {방식} 업체" 문구에만 쓴다. 둘 다 비워 둘 수 있다(nullable).
-- RLS 정책은 바꾸지 않는다. 사용자가 고칠 수 있는 입력 열이라 다른 입력 열처럼 열 단위 update grant만 준다.
alter table diagnoses
  add column current_processor_id text references processors(id),
  add column current_processor_name_raw text check (char_length(current_processor_name_raw) <= 100);
comment on column diagnoses.current_processor_id is '지금 맡기는 처리업체(processors.id). 요약 문구 전용, 순위 계산에 쓰지 않음';
comment on column diagnoses.current_processor_name_raw is '지금 맡기는 처리업체 이름 원문(서류 글자나 직접 입력, 100자 이하). 목록과 맞춰지지 않은 값';
grant update (current_processor_id, current_processor_name_raw) on diagnoses to authenticated;

-- 안산 안 후보: 추천 3곳(rank 1~3)과 별도로 rank 0 한 행을 저장해 연결 요청(candidate_id FK)이 가능하게 한다.
-- (diagnosis_id, rank) 유니크는 그대로라 진단마다 안산 안 후보는 최대 1곳.
alter table diagnosis_candidates drop constraint diagnosis_candidates_rank_check;
alter table diagnosis_candidates add constraint diagnosis_candidates_rank_check check (rank between 0 and 3);
comment on column diagnosis_candidates.rank is '1~3 추천 순위, 0 안산 안 후보(추천 3곳 밖의 안산 업체)';
