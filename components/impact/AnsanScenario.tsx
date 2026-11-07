// 안산 안 후보 칸(결정 2026-11-08, A안)의 가정 계산. 가정 계산기 바로 위에만 둔다(헤드라인과 발표 핵심 문장에 쓰지 않음).
// 지금 값(baseline)은 app_summary region_pct.안산을 읽어 데이터를 다시 빌드하면 바뀐다.
// 시나리오 값은 데이터 v3 기준 research/ai/recommender/scenario/README.md(S1 앱 1위 10.6, S2 안산 우선 상한 24.4).
// 공장이 안산 칸을 고르는 비율별 값(ansan_first/, 25/50/100%)은 아직 v2 기준이라 숫자 대신 "고르는 만큼 오른다"로만 쓴다.
// 데이터 v3 후 확인: ansan_first/를 v3로 다시 돌리면 비율별 값을 표에 더할 수 있다
import styles from './impact.module.css';

const RULE_ONLY_PCT = 10.6; // 데이터 v3 후 확인(scenario/README.md S1)
const ANSAN_FIRST_MAX_PCT = 24.4; // 데이터 v3 후 확인(scenario/README.md S2, 상한)

const pct = (v: number) => `${v.toFixed(1)}%`;

export function AnsanScenario({ baselinePct }: { baselinePct: number }) {
  return (
    <section className={styles.ansan} aria-labelledby="impact-ansan-title">
      <h3 id="impact-ansan-title" className={styles.ansanTitle}>
        RE:FIT은 검증된 순위는 그대로 두고 안산 안 재활용 업체를 따로 보여 줍니다
      </h3>
      <p className={styles.ansanLead}>
        재활용 업체로 바꾸기만 하면 안산 안 처리 비율이 오히려 줄 수 있어서입니다. 공장이 안산 칸을 고르는 만큼 안산 안 처리가
        오릅니다.
      </p>
      <p className={styles.assumeTag}>가정 계산, 신고 건수 기준, 업체 수용 여부 미확인</p>
      <table className={styles.ansanTable}>
        <caption className="sr-only">안산 안 처리 비율 가정 계산(신고 건수 기준, 업체 수용 여부 미확인)</caption>
        <thead>
          <tr>
            <th scope="col">경우</th>
            <th scope="col">안산 안 처리 비율</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">지금(2026-07 신고)</th>
            <td>{pct(baselinePct)}</td>
          </tr>
          <tr>
            <th scope="row">지금 추천 규칙 1위로만 바뀌면</th>
            <td>{pct(RULE_ONLY_PCT)}</td>
          </tr>
          <tr>
            <th scope="row">모두 안산 칸을 고르면(상한)</th>
            <td>{pct(ANSAN_FIRST_MAX_PCT)}</td>
          </tr>
        </tbody>
      </table>
      <p className={styles.ansanNote}>
        같은 폐기물을 이웃은 재활용하는데 우리는 태우는 신고가 다른 업체로 바뀐다고 가정한 계산입니다. 받는 업체가 실제로 받을 수
        있는지는 확인하지 않았습니다.
      </p>
    </section>
  );
}
