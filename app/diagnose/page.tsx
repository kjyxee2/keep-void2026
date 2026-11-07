// 1분 진단. 기본은 0단계 서류 사진(?start=photo 같음), ?start=manual 이면 1단계부터.
// ?factory=F0001 은 3단계 사업장을 미리 고르고 1단계(폐기물 종류)부터 시작한다. 이름으로 찾은 공장은 서류 사진이 없어도 되므로
// 0단계는 건너뛴다(?start=photo 를 함께 주면 0단계부터). ?d=<진단 id>는 새로고침 때 진행 복구용
import type { Metadata } from 'next';
import { DiagnoseFlow } from '@/components/diagnose/DiagnoseFlow';
import { loadChips } from '@/lib/diagnose-server';
import { isDiagnosisId, isFactoryId } from '@/lib/diagnose-state';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: '1분 진단 | RE:FIT',
  description: '계량표나 인계서 사진 한 장으로 우리 공장 폐기물이 어디로 가는지 확인해요.',
};

type Search = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function DiagnosePage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const resume = one(sp.d);
  const chips = await loadChips();
  const factoryId = one(sp.factory);
  const validFactory = isFactoryId(factoryId) ? factoryId : null;
  const start = one(sp.start);
  const initialStep = start === 'photo' ? 0 : start === 'manual' || validFactory ? 1 : 0;
  return (
    <main id="main" className={styles.main}>
      <DiagnoseFlow
        chips={chips}
        initialFactoryId={validFactory}
        initialStep={initialStep}
        resumeId={isDiagnosisId(resume) ? resume : null}
      />
    </main>
  );
}
