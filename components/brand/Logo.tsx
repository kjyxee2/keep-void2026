// 로고: Figma Logo/Symbol(64:19), Logo/Lockup(64:25). SVG 원본은 brand/logo에서 복사
import styles from './Logo.module.css';

type LogoProps = { className?: string; size?: 'sm' | 'md' | 'lg' };

/** 심볼과 워드마크를 같이 쓰는 기본 로고. 이름은 대체 글자로 읽힌다 */
export function LogoLockup({ className, size = 'md' }: LogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 벡터 원본을 그대로 보여 준다(이미지 최적화 불필요)
    <img
      src="/brand/logo/refit_lockup.svg"
      alt="RE:FIT"
      width={752}
      height={176}
      className={[styles.lockup, styles[size], className].filter(Boolean).join(' ')}
    />
  );
}

export function LogoSymbol({ className, size = 'md', decorative = false }: LogoProps & { decorative?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 벡터 원본을 그대로 보여 준다
    <img
      src="/brand/logo/refit_symbol.svg"
      alt={decorative ? '' : 'RE:FIT 심볼'}
      width={452}
      height={292}
      className={[styles.symbol, styles[size], className].filter(Boolean).join(' ')}
    />
  );
}
