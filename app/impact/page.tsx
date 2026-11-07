// 기대효과(Figma 04 Pages 07 기대효과: PC 184:3536, 모바일 185:3615). 계획 2026-11-08-refit-impact-features.md 결정: 본문은 A + B + D.
// 숫자는 공식 통계 원값, 신고 건수 집계, 고시 단가 원값(곱하지 않음), 사용자 입력만. 금액 가정은 맨 아래 가정 계산기 한 칸에만.
// 서버에서 app_summary, home_waste_stats, unit_prices, 앱 집계를 읽고 1시간마다 다시 만든다(ISR).
import type { Metadata } from 'next';
import { AnsanScenario } from '@/components/impact/AnsanScenario';
import { AssumptionCalc } from '@/components/impact/AssumptionCalc';
import { FactoryCalc } from '@/components/impact/FactoryCalc';
import { ScaleStats, type ScaleItem } from '@/components/impact/ScaleStats';
import { Button } from '@/components/ui/Button';
import { Footnote } from '@/components/ui/Footnote';
import { Stat } from '@/components/ui/Stat';
import { loadImpactData } from '@/lib/impact-data';
import styles from '@/components/impact/impact.module.css';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '기대효과 | RE:FIT',
  description: '버려지던 폐기물 중 원료로 바꿀 수 있는 길과, 바뀌었는지 확인하는 방법을 공식 통계와 신고 자료로 보여 줍니다.',
};

const SRC_OFFICIAL = '전국 폐기물 발생 및 처리현황 2024';
const SRC_REPORTS = '안산시 폐기물 배출자 신고현황 2026-07';

const n = (v: number) => v.toLocaleString('ko-KR');
const p1 = (v: number) => `${v.toFixed(1)}%`;

export default async function ImpactPage() {
  const d = await loadImpactData();
  const consignedPct = (d.official.consigned / d.official.generated) * 100;
  const priceDiff = d.prices.disposal - d.prices.recycler;
  const priceMax = Math.max(d.prices.disposal, d.prices.recycler);

  const scale: ScaleItem[] = [
    { value: d.official.generated, unit: '톤', label: '안산 사업장 배출시설계 폐기물 발생량', source: SRC_OFFICIAL },
    {
      value: d.official.consigned,
      unit: '톤',
      label: `그중 처리업체에 맡긴 양(위탁처리), 발생량의 ${p1(consignedPct)}`,
      source: SRC_OFFICIAL,
    },
    // 경기 31개 시군 중 1위: 같은 통계 원값으로 순위를 센 값(문제정의 2-1). 데이터 v3 후 확인
    { value: d.official.landfill, unit: '톤', label: '매립된 양, 2024 경기 31개 시군 중 1위', source: SRC_OFFICIAL },
    { value: d.plasticBurnTons, unit: '톤', label: '폐합성수지 중 처리업체에 맡겨 태운 양(위탁소각)', source: SRC_OFFICIAL },
  ];

  const outcomes = [
    { name: '안산 안 처리 비율', value: p1(d.reports.inAnsanPct), dir: '높이기', how: '안산 소재 처리업체로 가는 신고 / 전체 신고' },
    { name: '안산 안 원료 재활용 비율', value: p1(d.reports.inAnsanMaterialPct), dir: '높이기', how: '안산 안 원료 재활용 업체로 가는 신고 / 전체 신고' },
    {
      name: '같은 종류 다른 처리',
      value: p1(d.reports.sameTypePct),
      dir: '낮추기',
      how: '같은 종류에 원료 재활용 신고가 있는데 소각, 에너지회수로 가는 신고 / 전체 신고',
    },
    { name: 'RE:FIT으로 바꾼 신고', value: `${n(d.switched)}건`, dir: '늘리기', how: '재활용 업체로 바꿔 계약한 연결 요청을 앱 집계와 다음 신고현황으로 확인' },
  ];

  return (
    <main id="main" className={styles.main}>
      <section className={styles.intro} aria-labelledby="impact-title">
        <div className="container">
          <h1 id="impact-title" className={styles.h1}>
            버려지던 폐기물 중 원료로 바꿀 수 있는 길이 이만큼 있고, 바뀌면 이렇게 확인합니다.
          </h1>
          <p className={styles.lead}>
            아래 숫자는 공식 통계 원값과 신고 건수를 그대로 센 값입니다. 금액은 직접 넣은 값과 맨 아래 가정 계산기에서만 계산합니다.
          </p>
          <Button href="#impact-factory" arrow={false}>
            우리 공장 처리비 계산하기
          </Button>
        </div>
      </section>

      <section className={`${styles.band} ${styles.tint}`} aria-labelledby="impact-scale">
        <div className="container">
          <h2 id="impact-scale" className={styles.h2}>
            안산 공장에서 한 해 이만큼 나옵니다.
          </h2>
          <p className={styles.sub}>2024년 안산 사업장 배출시설계 폐기물 공식 통계 원값입니다.</p>
          <ScaleStats items={scale} />
        </div>
      </section>

      <section className={styles.band} aria-labelledby="impact-path">
        <div className="container">
          <h2 id="impact-path" className={styles.h2}>
            같은 폐기물인데 이웃은 재활용, 우리는 소각합니다.
          </h2>
          <p className={styles.sub}>이미 이웃 공장이 원료 재활용으로 보내는 폐기물이라 바꿀 수 있는 길이 있다는 뜻입니다.</p>
          <div className={styles.pathGrid}>
            <Stat
              value={`${n(Math.round(d.reports.sameTypeRows))}건`}
              label={`같은 종류에 원료 재활용 신고가 있는데 소각, 에너지회수로 가는 신고. 전체 ${n(d.reports.total)}건의 ${p1(d.reports.sameTypePct)}`}
              basis="신고 건수"
              source={SRC_REPORTS}
              className={styles.pathStat}
            />
            <Stat
              value={`${n(d.plastic.burnFactories)}곳`}
              label="폐합성수지를 소각, 에너지회수 업체에 맡기는 안산 공장"
              basis="신고 건수"
              source={SRC_REPORTS}
              className={styles.pathStat}
            />
            <Stat
              value={`${n(d.plastic.recycleFactories)}곳`}
              label="같은 폐합성수지를 원료 재활용 업체에 맡기는 안산 공장"
              basis="신고 건수"
              source={SRC_REPORTS}
              className={styles.pathStat}
            />
          </div>
        </div>
      </section>

      <section className={`${styles.band} ${styles.tint}`} aria-labelledby="impact-price">
        <div className={`container ${styles.split}`}>
          <div className={styles.splitIntro}>
            <h2 id="impact-price" className={styles.h2}>
              고시 단가로는 톤당 {n(priceDiff)}원 차이가 납니다.
            </h2>
            <p className={styles.sub}>
              같은 폐합성수지라도 정부 고시의 처분업자 단가와 재활용업자 단가가 다릅니다. 두 값은 {d.prices.year} 적용 고시 원값이고 실제
              계약가가 아닙니다. 무게와 곱하지 않습니다.
            </p>
          </div>
          <div className={styles.priceTable}>
            <dl className={styles.priceRows}>
              <div className={styles.priceRow}>
                <dt>
                  <span className={styles.priceName}>정부 고시 처분업자 단가</span>
                  <span className={styles.priceDetail}>폐합성수지, {d.prices.year} 적용</span>
                </dt>
                <dd className={styles.priceValue}>
                  <span className={styles.priceTrack} aria-hidden="true">
                    <span className={`${styles.priceBar} ${styles.burn}`} style={{ ['--ratio' as string]: d.prices.disposal / priceMax }} />
                  </span>
                  <span className={styles.priceAmount}>{n(d.prices.disposal)}원</span>
                </dd>
              </div>
              <div className={styles.priceRow}>
                <dt>
                  <span className={styles.priceName}>정부 고시 재활용업자 단가</span>
                  <span className={styles.priceDetail}>폐합성수지, {d.prices.year} 적용</span>
                </dt>
                <dd className={styles.priceValue}>
                  <span className={styles.priceTrack} aria-hidden="true">
                    <span className={`${styles.priceBar} ${styles.recycle}`} style={{ ['--ratio' as string]: d.prices.recycler / priceMax }} />
                  </span>
                  <span className={styles.priceAmount}>{n(d.prices.recycler)}원</span>
                </dd>
              </div>
              <div className={styles.priceRow}>
                <dt>
                  <span className={styles.priceName}>두 단가의 차이</span>
                  <span className={styles.priceDetail}>톤당, 원값끼리 뺀 값</span>
                </dt>
                <dd className={styles.priceDiff}>{n(priceDiff)}원 / 톤</dd>
              </div>
            </dl>
            <Footnote basis="고시 단가" className={styles.foot}>
              환경부고시 방치폐기물 처리이행보증보험금 산출용 폐기물 처리단가 {d.prices.year} 적용분(U001, U035)
            </Footnote>
          </div>
        </div>
      </section>

      <section className={styles.band} aria-labelledby="impact-factory">
        <div className={`container ${styles.split}`}>
          <div className={styles.splitIntro}>
            <h2 id="impact-factory" className={styles.h2}>
              우리 공장 처리비는 직접 넣은 값으로만 계산합니다.
            </h2>
            <p className={styles.sub}>
              계약서나 세금계산서의 톤당 금액과 계량표의 무게를 넣으면 지금 한 달 처리비가 나옵니다. 업체 견적을 받으면 그 금액과 나란히
              비교합니다.
            </p>
            <noscript>
              <p className={styles.sub}>계산 칸은 스크립트가 켜져 있어야 동작해요.</p>
            </noscript>
          </div>
          <FactoryCalc />
        </div>
      </section>

      <section className={`${styles.band} ${styles.tint}`} aria-labelledby="impact-measure">
        <div className="container">
          <h2 id="impact-measure" className={styles.h2}>
            바뀌었는지는 신고 자료로 다시 셉니다.
          </h2>
          <p className={styles.sub}>지금 값이 기준선입니다. 다음 신고현황이 나오면 같은 방법으로 다시 세어 비교합니다.</p>
          <table className={styles.measure}>
            <caption className="sr-only">성과 지표 기준선과 목표 방향</caption>
            <thead>
              <tr>
                <th scope="col">지표</th>
                <th scope="col">2026-07 기준선</th>
                <th scope="col">목표 방향</th>
                <th scope="col">다시 세는 법</th>
              </tr>
            </thead>
            <tbody>
              {outcomes.map((o) => (
                <tr key={o.name}>
                  <th scope="row">{o.name}</th>
                  <td className={styles.measureValue}>{o.value}</td>
                  <td className={styles.measureDir}>{o.dir}</td>
                  <td className={styles.measureHow}>{o.how}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Footnote basis="신고 건수" className={styles.foot}>
            {SRC_REPORTS}, RE:FIT 앱 집계
          </Footnote>
        </div>
      </section>

      <section className={styles.band} aria-labelledby="impact-assume">
        <div className={`container ${styles.assumeWrap}`}>
          <h2 id="impact-assume" className="sr-only">
            가정 계산
          </h2>
          <div className={styles.assumeCol}>
            <AnsanScenario baselinePct={d.reports.inAnsanPct} />
            <AssumptionCalc tons={d.plasticBurnTons} diffPerTon={priceDiff} priceYear={d.prices.year} />
            <noscript>
              <p className={styles.sub}>가정 계산기는 스크립트가 켜져 있어야 동작해요.</p>
            </noscript>
          </div>
          <div className={styles.sources}>
            <Footnote basis="공식 원값">{SRC_OFFICIAL}(환경부, 안산시 행)</Footnote>
            <Footnote basis="신고 건수">{SRC_REPORTS}(안산시 사전정보공표)</Footnote>
            <Footnote basis="고시 단가">환경부고시 폐기물 처리단가 {d.prices.year} 적용분</Footnote>
          </div>
        </div>
      </section>
    </main>
  );
}
