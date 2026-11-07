// 우리 공장 보고서. 안산시 지표는 서버에서 GET /api/dashboard 와 같은 함수를 불러 먼저 그린다
// (자기 자신에게 HTTP를 거치지 않음, 스크립트가 꺼져도 최종 숫자가 보임).
// 우리 공장 탭은 이 브라우저의 토큰이 필요해서 클라이언트에서 읽는다.
import type { Metadata } from 'next';
import { GET as dashboardRoute } from '@/app/api/dashboard/route';
import { ReportView, type ReportTab } from '@/components/report/ReportView';
import type { DashboardResponse } from '@/lib/types';
import './print.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '우리 공장 보고서 | RE:FIT',
  description: '우리 공장 진단 결과와 안산 산단 폐기물 흐름 지표를 신고 자료와 공식 통계 원값으로 보여 드려요.',
};

type Props = { searchParams: Promise<{ tab?: string | string[] }> };

async function loadDashboard(): Promise<DashboardResponse | null> {
  try {
    const res = await dashboardRoute();
    if (!res.ok) return null;
    return (await res.json()) as DashboardResponse;
  } catch {
    return null;
  }
}

export default async function ReportPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const initialTab: ReportTab = tab === 'city' ? 'city' : 'factory';
  const dashboard = await loadDashboard();
  return <ReportView initialTab={initialTab} initialDashboard={dashboard} />;
}
