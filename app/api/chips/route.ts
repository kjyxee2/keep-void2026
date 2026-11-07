import { cached, db, dbFail } from '@/lib/server';

// 진단 1단계: 품목 칩(안내 문구는 display_text 그대로)과 입력 선택지
export async function GET() {
  const [chips, volumes] = await Promise.all([
    db().from('waste_chips').select('*').order('id'),
    db().from('volume_options').select('*').order('id'),
  ]);
  if (chips.error || volumes.error) return dbFail(chips.error ?? volumes.error);
  return cached({
    chips: chips.data,
    volume_options: volumes.data,
    weight_sources: ['계량표', '올바로 인계서', '기타'],
    current_methods: ['소각', '매립', '에너지회수', '모름'],
    labels: { volume_options: '용기 개수는 참고 정보. 공식 환산 근거가 없어 무게로 바꾸지 않음' },
  });
}
