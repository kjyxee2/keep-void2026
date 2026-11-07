-- 같은 후보에 진행 중인 연결 요청은 1개만(감사 01 E-7). "센 뒤 넣기"의 동시 요청 경쟁을 DB가 막는다.
-- 진행 중 = cancelled, rejected가 아닌 상태(requested, contacted, sample, contracted, first_pickup).
-- 위반은 23505 → API가 409로 바꾼다. 적용 전 원격에 중복이 있으면 실패하므로 먼저 확인(06_backend_p0.md).
create unique index connection_requests_active_candidate_uniq
  on connection_requests (candidate_id)
  where status not in ('cancelled', 'rejected');
