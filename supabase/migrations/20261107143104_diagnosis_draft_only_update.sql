-- 완료된 진단은 바뀌지 않는다(공유 링크 고정). 본인 수정은 draft 상태일 때만.
-- 감사 01 E-5: own_update가 status를 보지 않아 completed 진단 입력을 PostgREST로 직접 고칠 수 있었음.
-- status 열 자체는 서버(서비스 키)만 바꿀 수 있다(20261107130000 열 단위 grant).
drop policy own_update on diagnoses;
create policy own_update on diagnoses for update to authenticated
  using (user_id = (select auth.uid()) and status = 'draft')
  with check (user_id = (select auth.uid()) and status = 'draft');
