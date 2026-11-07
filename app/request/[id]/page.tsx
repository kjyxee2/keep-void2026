// 연결 요청 완료. 요청 내용은 요청을 보낸 브라우저에 저장된 요약으로 클라이언트에서 그린다
// (연락처는 운영자와 처리업체만 조회하므로 요청 조회 API를 쓰지 않음).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RequestDone } from '@/components/request/RequestDone';

type Props = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = {
  title: '연결 요청 완료 | RE:FIT',
  description: '연결 요청을 보냈어요. 영업일 2일 안에 업체가 전화로 연락해요.',
  robots: { index: false },
};

export default async function RequestDonePage({ params }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <RequestDone id={id} />;
}
