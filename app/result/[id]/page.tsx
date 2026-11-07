// 결과 화면. 서버에서 GET /api/diagnoses/:id 와 같은 공유 보기(full=false)를 만들어 먼저 그린다
// (자기 자신에게 HTTP를 거치지 않고 같은 함수 buildResult를 부름). 토큰이 있는 브라우저는 클라이언트에서 전체 응답으로 바꾼다.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ResultView } from '@/components/result/ResultView';
import { buildResult, loadDiagnosis } from '@/lib/diagnosis';
import { isUuid } from '@/lib/server';
import type { DiagnosisResult } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = {
  title: '진단 결과 | RE:FIT',
  description: '우리 공장 폐기물이 지금 어디로 가는지, 같은 폐기물을 원료로 받는 업체가 어디인지 신고 자료로 보여 드려요.',
  robots: { index: false },
};

export default async function ResultPage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const diag = await loadDiagnosis(id);
  if (!diag || diag.status !== 'completed') notFound();
  const result = (await buildResult(diag, false)) as unknown as DiagnosisResult;
  return <ResultView initial={result} />;
}
