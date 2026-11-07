-- 보안 리뷰 후속: 본인 수정 범위 축소

-- diagnoses: 사용자가 고칠 수 있는 열은 진단 입력값만(명세 2-5 PATCH body + location_source).
-- tons_per_year, status, completed_at, waste_group(서버 계산), anon_token, user_id는 서버(서비스 키)만.
revoke update on diagnoses from anon, authenticated;
grant update (factory_id, volume_option_id, current_method, lat, lng, location_source) on diagnoses to authenticated;

-- group_memberships: diagnosis_id는 비우거나 본인 진단만
drop policy own on group_memberships;
create policy own on group_memberships for all to authenticated
  using (user_id = (select auth.uid()) or (select my_role()) = 'operator')
  with check (
    (select my_role()) = 'operator'
    or (user_id = (select auth.uid())
        and (diagnosis_id is null or exists (
          select 1 from diagnoses d where d.id = diagnosis_id and d.user_id = (select auth.uid())))));
