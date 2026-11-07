-- advisors 경고 anon_security_definer_function_executable 해소: anon은 /rest/v1/rpc/my_role 등을 부를 수 없게.
-- authenticated는 RLS 정책(to authenticated)이 이 함수를 부르므로 실행 권한을 남긴다
-- (authenticated_security_definer_function_executable 경고는 남음. 없애려면 private 스키마로 옮겨야 함).
revoke execute on function public.my_role() from public, anon;
revoke execute on function public.my_processor_id() from public, anon;
grant execute on function public.my_role() to authenticated;
grant execute on function public.my_processor_id() to authenticated;
