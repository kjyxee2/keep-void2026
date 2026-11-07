// 기능 설명 단계 띠(Figma 08 기능 설명 v2: PC 278:3661, 모바일 275:4480). 공용 편집형 Step 8개를 섹션 간격(140, 모바일 96)으로 쌓는다.
// 01, 02, 03, 08은 전체 폭 사진 오프너, 04~07은 라벨 열의 번호 + 헤드라인. 홀수 단계는 캡처 왼쪽, 짝수 단계는 오른쪽.
// 단계마다 Reveal 한 번(opacity, translateY만, 줄임 모드 0ms). 상세는 자세히 보기 안에 기본 닫힘. 정지 화면, 자동 연출 없음.
import { Step } from '@/components/editorial';
import { Reveal } from '@/components/motion/Reveal';
import type { HowStep } from '@/lib/how-steps';
import styles from './HowSteps.module.css';

export function HowSteps({ steps }: { steps: HowStep[] }) {
  return (
    <div className={styles.band}>
      {steps.map((step) => (
        <Reveal key={step.no}>
          <Step
            id={`how-step-${step.no}`}
            number={step.no}
            name={step.name}
            sentence={step.sentence}
            opener={step.opener}
            image={step.image}
            side={Number(step.no) % 2 === 1 ? 'left' : 'right'}
            stat={step.stat}
            detail={step.detail}
          />
        </Reveal>
      ))}
    </div>
  );
}
