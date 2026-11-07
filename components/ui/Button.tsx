// Figma Button(70:86): Style Primary/Secondary/Text x Size Mobile/PC x State
// 상태: Default, Hover, Pressed(:active), Focus(:focus-visible), Disabled, Loading
import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ArrowIcon } from '@/components/brand/Icon';
import styles from './Button.module.css';

type Common = {
  variant?: 'primary' | 'secondary' | 'text';
  /** mobile: 줄 전체 폭, pc: 내용 폭(최소 240) */
  size?: 'mobile' | 'pc';
  /** 오른쪽 화살표 아이콘(Text 스타일에는 없음) */
  arrow?: boolean;
  loading?: boolean;
  children: ReactNode;
  className?: string;
};

type AsButton = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> & { href?: undefined };
type AsLink = Common & { href: string; disabled?: undefined; onClick?: () => void };

export type ButtonProps = AsButton | AsLink;

export function Button(props: ButtonProps) {
  const { variant = 'primary', size = 'pc', arrow = variant !== 'text', loading = false, children, className } = props;
  const cls = [styles.button, styles[variant], styles[size], loading && styles.loading, className].filter(Boolean).join(' ');
  const inner = (
    <>
      <span className={styles.label}>{children}</span>
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        arrow && variant !== 'text' && <ArrowIcon size="sm" />
      )}
      {loading && <span className="sr-only">불러오는 중이에요</span>}
    </>
  );

  if (props.href !== undefined) {
    return (
      <Link href={props.href} className={cls} onClick={props.onClick}>
        {inner}
      </Link>
    );
  }

  const { variant: _v, size: _s, arrow: _a, loading: _l, children: _c, className: _cn, disabled, type = 'button', ...rest } = props;
  void _v; void _s; void _a; void _l; void _c; void _cn;
  return (
    <button
      {...rest}
      type={type}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {inner}
    </button>
  );
}
