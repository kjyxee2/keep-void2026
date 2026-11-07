// 안산시 지표 탭(Figma 82:2758, 82:2548). 지표 4개(CountUp, 이 탭의 유일한 자동 연출), 4년 추이 막대(정지), 2024 공식 통계, 앱 실제 집계.
// 모든 값은 /api/dashboard 원값. 추이 막대 높이는 0을 바닥으로 한 비율 그대로.
import { CountUp } from '@/components/motion';
import { Footnote } from '@/components/ui/Footnote';
import { LegendMark } from '@/components/ui/Legend';
import { Skeleton, ErrorState } from '@/components/ui/States';
import { Stat } from '@/components/ui/Stat';
import { GYEONGGI_LANDFILL_RANK, SOURCES, trendSentence, type CitySummary } from '@/lib/report-data';
import { num } from '@/lib/result-copy';
import type { DashboardResponse } from '@/lib/types';
import styles from './report.module.css';

const pct = (v: number) => `${v.toFixed(1)}%`;

export function CityTab({
  city,
  app,
  state,
  onRetry,
}: {
  city: CitySummary | null;
  app: DashboardResponse['app'] | null;
  state: 'idle' | 'loading' | 'error';
  onRetry: () => void;
}) {
  if (!city) {
    if (state === 'error') return <ErrorState message="지표를 불러오지 못했어요. 다시 시도해 주세요" onRetry={onRetry} />;
    return <Skeleton lines={4} />;
  }
  const period = city.period ?? '2026-07';
  const trend = city.trend;
  const sentence = trendSentence(trend);
  const maxIn = Math.max(...trend.map((t) => t.inAnsan), 0);

  return (
    <div className={styles.stack}>
      {city.indicators.length > 0 && (
        <section aria-labelledby="city-ind" className={styles.section}>
          <h2 id="city-ind" className="sr-only">
            흐름 지표
          </h2>
          <div className={styles.statGrid}>
            {city.indicators.map((i) => (
              <Stat
                key={i.key}
                className={styles.stat}
                value={<CountUp to={i.value} decimals={1} suffix="%" />}
                label={i.label}
                basis="신고 건수"
                source={SOURCES.reports(period)}
              />
            ))}
          </div>
        </section>
      )}

      <div className={styles.cityGrid}>
        {trend.length > 0 && sentence && (
          <section aria-labelledby="city-trend" className={`${styles.section} ${styles.ruled}`}>
            <h2 id="city-trend" className={styles.h2}>
              {sentence.title}
            </h2>
            <p className={styles.lead}>{sentence.body}</p>
            <figure className={styles.chart} aria-hidden="true">
              <div className={styles.bars}>
                {trend.map((t, i) => {
                  const last = i === trend.length - 1;
                  return (
                    <div key={t.period} className={styles.barCol}>
                      <span className={`${styles.barValue} ${last ? styles.barValueLast : ''} count`}>{pct(t.inAnsan)}</span>
                      <span className={styles.barTrack}>
                        <span
                          className={`${styles.bar} ${last ? styles.barLast : ''}`}
                          style={{
                            ['--h' as string]: maxIn > 0 ? t.inAnsan / maxIn : 0,
                          }}
                        />
                      </span>
                      <span className={`${styles.barLabel} ${last ? styles.barLabelLast : ''}`}>{t.period}</span>
                    </div>
                  );
                })}
              </div>
            </figure>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption className="sr-only">시점별 신고 경로 비율(신고 건수 기준, 톤수 아님)</caption>
                <thead>
                  <tr>
                    <th scope="col">연월</th>
                    <th scope="col">안산 안</th>
                    <th scope="col">경기 밖</th>
                    <th scope="col">원료 재활용</th>
                    <th scope="col">소각</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.map((t, i) => (
                    <tr key={t.period} className={i === trend.length - 1 ? styles.rowStrong : undefined}>
                      <th scope="row">{t.period}</th>
                      <td className="count">{pct(t.inAnsan)}</td>
                      <td className="count">{pct(t.outGyeonggi)}</td>
                      <td className="count">{pct(t.material)}</td>
                      <td className="count">{pct(t.burn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Footnote basis="신고 건수">{SOURCES.trend(trend.map((t) => t.period))}</Footnote>
          </section>
        )}

        {city.official && (
          <section aria-labelledby="city-official" className={`${styles.section} ${styles.ruled}`}>
            <h2 id="city-official" className={styles.h2}>
              2024 공식 통계 사업장 배출시설계 폐기물
            </h2>
            <p className={styles.bigTon}>
              <span className="count">{num(city.official.generated)}</span>톤
            </p>
            <p className={styles.small}>한 해 발생량</p>
            <table className={styles.offTable}>
              <caption className="sr-only">2024 안산시 사업장 배출시설계 폐기물 처리 방법별 톤수(공식 통계 원값)</caption>
              <tbody>
                {city.official.rows.map((r) => (
                  <tr key={r.key}>
                    <th scope="row">
                      <span className={styles.offLabel}>
                        {r.key === 'entrusted' ? (
                          <span className={styles.markBlank} aria-hidden="true" />
                        ) : (
                          <LegendMark type={r.key === 'recycle' ? 'recycle' : r.key === 'burn' ? 'burn' : 'landfill'} />
                        )}
                        {r.key === 'entrusted' ? '위탁처리(처리 주체 기준)' : r.label}
                      </span>
                    </th>
                    <td className="count">{num(r.ton)}톤</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {city.official.rows.some((r) => r.key === 'landfill') && (
              <div className={styles.callout}>
                <p className={styles.calloutTitle}>{GYEONGGI_LANDFILL_RANK.title}</p>
                <p className={styles.small}>
                  안산시 사업장 배출시설계 매립 {num(city.official.rows.find((r) => r.key === 'landfill')?.ton ?? 0)}톤
                </p>
                <Footnote basis="공식 원값">{GYEONGGI_LANDFILL_RANK.source}</Footnote>
              </div>
            )}
            <Footnote basis="공식 원값">{SOURCES.official}</Footnote>
          </section>
        )}
      </div>

      {app && (
        <section aria-labelledby="city-app" className={styles.section}>
          <h2 id="city-app" className={styles.h2}>
            RE:FIT 서비스 기록
          </h2>
          <p className={styles.lead}>서비스를 연 뒤 실제로 쌓인 값만 셉니다.</p>
          <ul role="list" className={styles.appGrid}>
            {[
              [app.diagnoses_completed, '마친 진단 수'],
              [app.requests_active, '진행 중인 처리업체 연결 요청 수'],
              [app.routes_switched_to_recycling, '소각과 매립에서 재활용으로 바꾼 신고 수'],
            ].map(([v, label]) => (
              <li key={label} className={styles.appStat}>
                <span className={`${styles.appValue} count`}>{num(v as number)}</span>
                <span className={styles.appLabel}>{label}</span>
              </li>
            ))}
          </ul>
          <Footnote basis="앱 집계">{SOURCES.app}</Footnote>
        </section>
      )}
    </div>
  );
}
