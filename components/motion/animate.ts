// 숫자 하나를 from에서 to까지 세는 requestAnimationFrame 루프. 곡선은 MOTION.ease(tokens.css --ease-standard와 같은 cubic-bezier).
// 돌려주는 함수를 부르면 멈춘다(언마운트, 값 변경).
import { MOTION } from './tokens';

/** CSS cubic-bezier(x1, y1, x2, y2)와 같은 진행 곡선. x(t)를 이분법으로 뒤집어 y를 돌려준다 */
export function cubicBezier([x1, y1, x2, y2]: readonly [number, number, number, number]) {
  const curve = (a: number, b: number, t: number) => 3 * a * (1 - t) * (1 - t) * t + 3 * b * (1 - t) * t * t + t * t * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 24; i += 1) {
      const cx = curve(x1, x2, t);
      if (Math.abs(cx - x) < 1e-5) break;
      if (cx < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return curve(y1, y2, t);
  };
}

const easeStandard = cubicBezier(MOTION.ease);

export function animateValue({
  from,
  to,
  duration,
  onUpdate,
  onComplete,
}: {
  from: number;
  to: number;
  /** 초 */
  duration: number;
  onUpdate: (value: number) => void;
  onComplete?: () => void;
}) {
  if (duration <= 0 || from === to) {
    onUpdate(to);
    onComplete?.();
    return () => {};
  }
  let raf = 0;
  const start = performance.now();
  const tick = (now: number) => {
    const p = Math.min((now - start) / (duration * 1000), 1);
    onUpdate(from + (to - from) * easeStandard(p));
    if (p < 1) raf = requestAnimationFrame(tick);
    else onComplete?.();
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
