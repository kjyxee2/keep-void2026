import { db, dbFail, json } from '@/lib/server';

// 시 대시보드: summary.json(신고 건수 집계, 공식 통계 원값) + 앱 실제 집계
export async function GET() {
  const count = (t: string) => db().from(t).select('*', { count: 'exact', head: true });
  const [summary, diagnoses, requests, switched] = await Promise.all([
    db().from('app_summary').select('data').eq('id', 1).maybeSingle(),
    count('diagnoses').eq('status', 'completed'),
    count('connection_requests').not('status', 'in', '(cancelled,rejected)'),
    count('connection_requests').in('status', ['contracted', 'first_pickup']),
  ]);
  const err = summary.error ?? diagnoses.error ?? requests.error ?? switched.error;
  if (err) return dbFail(err);
  return json({
    summary: summary.data?.data ?? null,
    app: {
      diagnoses_completed: diagnoses.count ?? 0,
      requests_active: requests.count ?? 0,
      routes_switched_to_recycling: switched.count ?? 0,
      basis: '앱 실제 집계',
    },
    labels: { summary: '신고 건수 집계(톤수 아님) 또는 공식 통계 원값. 각 값의 basis 참고' },
  });
}
