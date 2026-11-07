// 우리 공장 보고서 화면(Figma 151:3000, 82:2758). 탭 두 개: 우리 공장, 안산시 지표.
// 탭은 ARIA tablist(좌우 화살표, Home, End)이고 선택은 주소 ?tab=factory|city 에 남긴다.
// 공용 Tabs(components/ui/Tabs)는 선택 상태를 밖에서 정할 수 없어서 같은 스타일로 여기서 제어한다.
'use client';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/Button';
import tabStyles from '@/components/ui/Tabs.module.css';
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
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

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

  const select = (next: ReportTab, focus = false) => {
    setTab(next);
    if (focus) refs.current[TABS.findIndex((t) => t.id === next)]?.focus();
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', next);
      window.history.replaceState(window.history.state, '', url);
    } catch {
      /* 주소를 못 바꿔도 화면은 바뀐다 */
    }
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = TABS.length;
    const to: Record<string, number> = {
      ArrowRight: (i + 1) % n,
      ArrowLeft: (i - 1 + n) % n,
      Home: 0,
      End: n - 1,
    };
    if (e.key in to) {
      e.preventDefault();
      select(TABS[to[e.key]].id, true);
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
          <div role="tablist" aria-label="보고서 보기" className={tabStyles.list} data-report-noprint>
            {TABS.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`report-tab-${t.id}`}
                aria-selected={t.id === tab}
                aria-controls={`report-panel-${t.id}`}
                tabIndex={t.id === tab ? 0 : -1}
                className={tabStyles.tab}
                onClick={() => select(t.id)}
                onKeyDown={(e) => onKey(e, i)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div
            role="tabpanel"
            id="report-panel-factory"
            aria-labelledby="report-tab-factory"
            hidden={tab !== 'factory'}
            tabIndex={0}
            className={`${styles.panel} tab-fade-in`}
          >
            <FactoryTab active={tab === 'factory'} switched={dashboard?.app.routes_switched_to_recycling ?? null} />
          </div>
          <div
            role="tabpanel"
            id="report-panel-city"
            aria-labelledby="report-tab-city"
            hidden={tab !== 'city'}
            tabIndex={0}
            className={`${styles.panel} tab-fade-in`}
          >
            <CityTab city={city} app={dashboard?.app ?? null} state={dashState} onRetry={loadDashboard} />
          </div>
        </div>
      </div>
    </main>
  );
}
