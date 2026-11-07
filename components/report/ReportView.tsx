// 우리 공장 보고서 화면(Figma 151:3000, 82:2758). 탭 두 개: 우리 공장, 안산시 지표.
// 탭은 공용 Tabs(components/ui/Tabs)의 제어 모드(value, onChange)로 쓰고 선택은 주소 ?tab=factory|city 에 남긴다.
'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { getDashboard } from '@/lib/api-client';
import { parseCitySummary } from '@/lib/report-data';
import { num } from '@/lib/result-copy';
import type { DashboardResponse } from '@/lib/types';
import { CityTab } from './CityTab';
import { FactoryTab } from './FactoryTab';
import styles from './report.module.css';

export type ReportTab = 'factory' | 'city';

const TABS: { id: ReportTab; label: string; title: string }[] = [
  { id: 'factory', label: '우리 공장', title: '우리 공장 보고서' },
  { id: 'city', label: '안산시 지표', title: '안산 산단 폐기물 흐름 지표' },
];

export function ReportView({ initialTab, initialDashboard }: { initialTab: ReportTab; initialDashboard: DashboardResponse | null }) {
  const [tab, setTab] = useState<ReportTab>(initialTab);
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [dashState, setDashState] = useState<'idle' | 'loading' | 'error'>('idle');

  // 서버에서 못 받았으면 브라우저에서 한 번 더
  const loadDashboard = useCallback(async () => {
    setDashState('loading');
    try {
      setDashboard(await getDashboard());
      setDashState('idle');
    } catch {
      setDashState('error');
    }
  }, []);
  useEffect(() => {
    if (!initialDashboard) void loadDashboard();
  }, [initialDashboard, loadDashboard]);

  const select = (id: string) => {
    const next: ReportTab = id === 'city' ? 'city' : 'factory';
    setTab(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', next);
      window.history.replaceState(window.history.state, '', url);
    } catch {
      /* 주소를 못 바꿔도 화면은 바뀐다 */
    }
  };

  const city = dashboard ? parseCitySummary(dashboard.summary) : null;
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <main id="main" className={styles.page} data-report-root>
      <div className={`container ${styles.wrap}`}>
        <header className={styles.intro}>
          <div className={styles.introTop}>
            <h1 className={styles.title}>{current.title}</h1>
            <div data-report-noprint>
              <Button variant="text" onClick={() => window.print()}>
                보고서 내려받기
              </Button>
            </div>
          </div>
          {tab === 'city' && city?.period && city.totalReports != null && (
            <p className={styles.meta}>
              {city.period} 배출자 신고 <span className="count">{num(city.totalReports)}</span>건 집계(흐름 비율은 신고 건수이며 톤수가
              아님)
            </p>
          )}
          {tab === 'factory' && <p className={styles.meta}>이 브라우저에서 마지막으로 마친 진단 기준</p>}
        </header>

        <div className={styles.tabs}>
          <Tabs
            label="보고서 보기"
            idBase="report"
            value={tab}
            onChange={select}
            listProps={{ 'data-report-noprint': '' }}
            panelClassName={styles.panel}
            items={[
              {
                id: 'factory',
                label: TABS[0].label,
                content: <FactoryTab active={tab === 'factory'} switched={dashboard?.app.routes_switched_to_recycling ?? null} />,
              },
              {
                id: 'city',
                label: TABS[1].label,
                content: <CityTab city={city} app={dashboard?.app ?? null} state={dashState} onRetry={loadDashboard} />,
              },
            ]}
          />
        </div>
      </div>
    </main>
  );
}
