// Framer Motion용 모션 값. styles/motion.css, Figma RE:FIT v3 Motion과 같은 값(초 단위)
export const MOTION = {
  short: 0.15,
  base: 0.25,
  emphasis: 0.4,
  data: 0.8,
  stagger: 0.08,
  /* 홈 히어로 슬라이드 한 장이 머무는 시간(--motion-dwell = data의 2.5배) */
  dwell: 2,
  ease: [0.2, 0, 0, 1] as [number, number, number, number],
};
