// 기대효과(Figma 05 Pages v2 07 기대효과: PC 184:3536, 모바일 185:3615). 사진 오프너 세 장(s15_plant, s13_aerial, s14_pellets)과
// 라벨 열 200 + 글 열의 편집형 블록 일곱 개, 끝에 어두운 캡처 격자. 카드 없음, 1px 선과 여백으로만 나눈다.
// 숫자는 공식 통계 원값, 신고 건수 집계, 고시 단가 원값(곱하지 않음), 사용자 입력만. 금액 가정은 맨 아래 가정 계산기 한 칸에만.
// 서버에서 app_summary, home_waste_stats, unit_prices, 앱 집계를 읽고 1시간마다 다시 만든다(ISR).
import type { Metadata } from 'next';
import { DarkGrid, MediaBand, PhotoOpener, Row, SectionHead, Stat, AccordionRow } from '@/components/editorial';
import { AssumptionCalc } from '@/components/impact/AssumptionCalc';
import { FactoryCalc } from '@/components/impact/FactoryCalc';
import { LineRows } from '@/components/impact/LineRows';
import { CountUp, Reveal } from '@/components/motion';
import { Footnote } from '@/components/ui/Footnote';
import { loadImpactData } from '@/lib/impact-data';
import styles from '@/components/impact/impact.module.css';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '기대효과 | RE:FIT',
  description: '버려지던 폐기물 중 원료로 바꿀 수 있는 길과, 바뀌었는지 확인하는 방법을 공식 통계와 신고 자료로 보여 줍니다.',
};

const n = (v: number) => v.toLocaleString('ko-KR');
const p1 = (v: number) => `${v.toFixed(1)}%`;

/** 큰 숫자: 화면에 들어오면 0에서 한 번 센다. 단위 앞 <wbr>은 모바일 두 열에서만 줄을 바꾼다 */
function Num({ value, unit, decimals = 0 }: { value: number; unit: string; decimals?: number }) {
  return (
    <>
      <CountUp to={value} decimals={decimals} fromZero />
      <wbr />
      {unit}
    </>
  );
}

export default async function ImpactPage() {
  const d = await loadImpactData();
  const consignedPct = (d.official.consigned / d.official.generated) * 100;
  const priceDiff = d.prices.disposal - d.prices.recycler;
  const sameTypeRows = Math.round(d.reports.sameTypeRows);

  return (
    <main id="main" className={styles.main}>
      <section className={styles.block} aria-labelledby="impact-title">
        <PhotoOpener
          src="/photos/sections/s15_plant.jpg"
          alt="안산 산단의 공장 건물 바깥, 설비와 가로수가 늘어선 길"
          label="기대효과"
          as="h1"
          id="impact-title"
          priority
          className={styles.opener}
          headline={
            <>
              버려지던 폐기물 중 원료로 바꿀 수 있는 길이
              <br className={styles.br} /> 이만큼 있고, 바뀌면 이렇게 확인합니다.
            </>
          }
        />
        <div className="editorial-container">
          <Row indent>
            <p className={styles.sentence}>공식 통계 원값과 신고 건수를 그대로 센 값입니다.</p>
          </Row>
        </div>
        <div className="editorial-container">
          <MediaBand
            src="/how/04-source-label.png"
            alt="안산 공장들이 폐합성수지를 보내는 길(신고 1,209건) 막대. 소각 38.1%, 에너지회수 11.2%, 원료 재활용 13.5%, 중간가공 21.7%, 미확인 등 15.5%이고 아래에 신고 건수 집계 출처가 적혀 있다."
            ratio="intro"
            position="center"
          />
        </div>
      </section>

      <section className={styles.block} aria-labelledby="impact-scale">
        <PhotoOpener
          src="/photos/sections/s13_aerial.jpg"
          alt="해 질 녘 바다 옆 안산 산업단지를 위에서 내려다본 모습"
          label="규모"
          id="impact-scale"
          className={styles.opener}
          headline={
            <>
              안산 공장에서 한 해
              <br className={styles.br} /> 이만큼 나옵니다.
            </>
          }
        />
        <div className="editorial-container">
          <Row indent>
            <p className={styles.sentence}>공식 통계 원값입니다.</p>
          </Row>
        </div>
        <div className="editorial-container">
          <Row indent>
            <div className={styles.content}>
              <Reveal className={styles.stats2}>
                <Stat size="h1" tone="primary" rule="none" className={styles.stat} value={<Num value={d.official.generated} unit="톤" />} caption="발생량" />
                <Stat
                  size="h1"
                  tone="primary"
                  rule="none"
                  className={styles.stat}
                  value={<Num value={d.official.consigned} unit="톤" />}
                  caption={`위탁처리, ${p1(consignedPct)}`}
                />
                <Stat size="h1" tone="primary" rule="none" className={styles.stat} value={<Num value={d.official.landfill} unit="톤" />} caption="매립, 경기 1위" />
                <Stat size="h1" tone="primary" rule="none" className={styles.stat} value={<Num value={d.plasticBurnTons} unit="톤" />} caption="폐합성수지 위탁소각" />
              </Reveal>
              <p className={styles.source}>출처: 전국 폐기물 처리현황 2024</p>
              <AccordionRow title="자세히 보기">
                <p>
                  2024년 안산 사업장 배출시설계 폐기물 공식 통계 원값입니다. {n(d.official.generated)}톤은 안산 사업장 배출시설계 폐기물 발생량,{' '}
                  {n(d.official.consigned)}톤은 그중 처리업체에 맡긴 양(위탁처리)으로 발생량의 {p1(consignedPct)}, {n(d.official.landfill)}톤은 매립된
                  양으로 2024 경기 31개 시군 중 1위, {n(d.plasticBurnTons)}톤은 폐합성수지 중 처리업체에 맡겨 태운 양(위탁소각)입니다. 출처 (공식
                  통계 원값): 전국 폐기물 발생 및 처리현황 2024.
                </p>
              </AccordionRow>
            </div>
          </Row>
        </div>
      </section>

      <section className={styles.block} aria-labelledby="impact-path">
        <PhotoOpener
          src="/photos/sections/s14_pellets.jpg"
          alt="재활용 공장에서 투명한 플라스틱 조각이 쏟아져 자루에 담기는 모습"
          label="바꿀 길"
          id="impact-path"
          className={styles.opener}
          headline={
            <>
              같은 폐기물인데 이웃은 재활용,
              <br className={styles.br} /> 우리는 소각합니다.
            </>
          }
        />
        <div className="editorial-container">
          <Row indent>
            <p className={styles.sentence}>이웃 공장이 재활용으로 보냅니다.</p>
          </Row>
        </div>
        <div className="editorial-container">
          <Row indent>
            <div className={styles.content}>
              <Reveal className={styles.stats3}>
                <Stat
                  size="h1"
                  tone="primary"
                  rule="none"
                  className={styles.stat}
                  value={<Num value={sameTypeRows} unit="건" />}
                  caption={`소각으로 가는 신고, ${p1(d.reports.sameTypePct)}`}
                />
                <Stat size="h1" tone="primary" rule="none" className={styles.stat} value={<Num value={d.plastic.burnFactories} unit="곳" />} caption="소각 쪽 공장" />
                <Stat size="h1" tone="primary" rule="none" className={styles.stat} value={<Num value={d.plastic.recycleFactories} unit="곳" />} caption="재활용 쪽 공장" />
              </Reveal>
              <AccordionRow title="자세히 보기">
                <p>
                  이미 이웃 공장이 원료 재활용으로 보내는 폐기물이라 바꿀 수 있는 길이 있다는 뜻입니다. {n(sameTypeRows)}건은 같은 종류에 원료 재활용
                  신고가 있는데 소각, 에너지회수로 가는 신고로 전체 {n(d.reports.total)}건의 {p1(d.reports.sameTypePct)}, {n(d.plastic.burnFactories)}곳은
                  폐합성수지를 소각, 에너지회수 업체에 맡기는 안산 공장, {n(d.plastic.recycleFactories)}곳은 같은 폐합성수지를 원료 재활용 업체에 맡기는
                  안산 공장입니다. 출처 (신고 건수 집계): 안산시 폐기물 배출자 신고현황 2026-07.
                </p>
              </AccordionRow>
            </div>
          </Row>
        </div>
      </section>

      <section className={styles.block} aria-labelledby="impact-price">
        <div className="editorial-container">
          <SectionHead
            label="단가 차이"
            id="impact-price"
            headline={
              <>
                고시 단가로는
                <br className={styles.br} /> 톤당 {n(priceDiff)}원 차이가 납니다.
              </>
            }
            sentence="고시 원값입니다."
          />
        </div>
        <div className="editorial-container">
          <Row indent>
            <div className={styles.content}>
              <Reveal>
                <LineRows
                  caption="고시 단가 비교"
                  rows={[
                    { label: '처분업자 단가', value: `${n(d.prices.disposal)}원` },
                    { label: '재활용업자 단가', value: `${n(d.prices.recycler)}원` },
                    { label: '차이', value: `${n(priceDiff)}원/톤` },
                  ]}
                />
              </Reveal>
              <Footnote basis="고시 단가">환경부 고시 {d.prices.year}</Footnote>
              <AccordionRow title="자세히 보기">
                <p>
                  같은 폐합성수지라도 정부 고시의 처분업자 단가와 재활용업자 단가가 다릅니다. 두 값은 {d.prices.year} 적용 고시 원값이고 실제 계약가가
                  아닙니다. 무게와 곱하지 않습니다. 두 단가의 차이는 톤당, 원값끼리 뺀 값입니다. 출처: 환경부 고시 폐기물 처리단가 {d.prices.year} 적용.
                </p>
              </AccordionRow>
            </div>
          </Row>
        </div>
      </section>

      <section className={styles.block} aria-labelledby="impact-factory">
        <div className="editorial-container">
          <SectionHead label="우리 공장 계산" id="impact-factory" headline="직접 넣은 값으로만 계산합니다." sentence="톤당 처리비 × 무게(kg) ÷ 1,000" />
        </div>
        <div className="editorial-container">
          <Row indent>
            <FactoryCalc />
            <noscript>
              <p className={styles.sentence}>계산 칸은 스크립트가 켜져 있어야 동작해요.</p>
            </noscript>
          </Row>
        </div>
      </section>

      <section className={styles.block} aria-labelledby="impact-measure">
        <div className="editorial-container">
          <SectionHead label="성과" id="impact-measure" headline="바뀌었는지는 신고 자료로 다시 셉니다." sentence="지금 값이 기준선입니다." />
        </div>
        <div className="editorial-container">
          <Row indent>
            <div className={styles.content}>
              <Reveal>
                <LineRows
                  caption="성과 지표 기준선"
                  rows={[
                    { label: '안산 안 처리 비율', value: p1(d.reports.inAnsanPct) },
                    { label: '안산 안 원료 재활용 비율', value: p1(d.reports.inAnsanMaterialPct) },
                    { label: '같은 종류 다른 처리', value: p1(d.reports.sameTypePct) },
                    { label: 'RE:FIT으로 바꾼 신고', value: `${n(d.switched)}건` },
                  ]}
                />
              </Reveal>
              <p className={styles.source}>출처: 앱 집계</p>
              <AccordionRow title="자세히 보기">
                <p>
                  2026-07 기준선입니다. 다음 신고현황이 나오면 같은 방법으로 다시 세어 비교합니다. 안산 안 처리 비율(높이기): 안산 소재 처리업체로 가는
                  신고 / 전체 신고. 안산 안 원료 재활용 비율(높이기): 안산 안 원료 재활용 업체로 가는 신고 / 전체 신고. 같은 종류 다른 처리(낮추기): 같은
                  종류에 원료 재활용 신고가 있는데 소각, 에너지회수로 가는 신고 / 전체 신고. RE:FIT으로 바꾼 신고(늘리기): 소각, 매립에서 재활용 업체로
                  바꾼 신고를 앱 집계와 다음 신고현황으로 확인. 출처 (신고 건수 집계): 안산시 폐기물 배출자 신고현황 2026-07, RE:FIT 앱 집계.
                </p>
              </AccordionRow>
            </div>
          </Row>
        </div>
      </section>

      <div id="impact-assume" className={`editorial-container ${styles.block}`}>
        <Row label="가정 계산기">
          <AssumptionCalc tons={d.plasticBurnTons} diffPerTon={priceDiff} priceYear={d.prices.year} />
          <noscript>
            <p className={styles.sentence}>가정 계산기는 스크립트가 켜져 있어야 동작해요.</p>
          </noscript>
        </Row>
      </div>

      <DarkGrid
        className={styles.block}
        images={[
          { src: '/how/05-price-check.png', alt: '홈 화면: 지금 내는 톤당 처리비를 넣으면 고시 단가와 나란히 보여 주는 칸' },
          { src: '/how/02-current-route.png', alt: '우리 공장 보고서: 사업장, 폐기물, 운반, 처리업체, 처리 방식이 한 줄씩 적힌 지금 경로' },
          { src: '/how/08-map.png', alt: '이웃 공장 지도: 안산 산단 윤곽 위에 폐합성수지 배출 공장과 처리업체 핀' },
          { src: '/how/06-groups.png', alt: '같이 맡기기: 같은 동의 공장 10곳 위치가 원 안에 찍힌 묶음 칸' },
        ]}
      />

      <div className={`editorial-container ${styles.sources}`}>
        <Footnote basis="신고 건수">안산시 배출자 신고현황 2026-07, 환경부 고시 {d.prices.year}. 금액 효과는 추정하지 않음</Footnote>
      </div>
    </main>
  );
}
