// 단계 전환: 다음은 오른쪽에서, 이전은 왼쪽에서 translateX 24px + opacity(250ms, 나갈 때 150ms). styles/motion.css [data-motion-step].
// stepKey가 바뀔 때만 움직인다: 이전 내용을 data-state exit로 150ms 내보낸 뒤 새 내용을 key를 바꿔 다시 그리며 등장 키프레임(250ms)을 돈다.
// 줄임 모드면 즉시 교체(시간 0, 같은 구조라 hydration 안전).
'use client';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { MOTION } from './tokens';
import { useReducedMotion } from './useReducedMotion';

type View = { key: string | number; children: ReactNode; entered: boolean };

export function SlideStep({
  stepKey,
  direction = 1,
  children,
  className,
}: {
  stepKey: string | number;
  /** 1: 다음 단계, -1: 이전 단계 */
  direction?: 1 | -1;
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  // 화면에 그리고 있는 단계. stepKey가 바뀌어도 내보내는 동안은 이전 내용을 그대로 들고 있는다. 첫 렌더는 등장 연출 없음
  const [view, setView] = useState<View>({ key: stepKey, children, entered: false });
  const latest = useRef(children);
  useEffect(() => {
    latest.current = children;
  });

  useEffect(() => {
    if (stepKey === view.key) return;
    if (reduce) {
      setView({ key: stepKey, children: latest.current, entered: false });
      return;
    }
    const t = setTimeout(() => setView({ key: stepKey, children: latest.current, entered: true }), MOTION.short * 1000);
    return () => clearTimeout(t);
  }, [stepKey, view.key, reduce]);

  const same = stepKey === view.key;
  return (
    <div
      key={view.key}
      className={className}
      data-motion-step=""
      data-state={!same ? 'exit' : view.entered ? 'enter' : 'idle'}
      style={{ '--dir': direction } as CSSProperties}
    >
      {same ? children : view.children}
    </div>
  );
}
