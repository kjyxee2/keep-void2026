// 아이콘: brand/icons/*.svg 원본을 currentColor로 옮긴 것(Figma Icon/Waste 122:93, Icon/Method 122:94)
import type { SVGProps } from 'react';
import styles from './Icon.module.css';

export type WasteType = '폐합성수지' | '폐수처리오니' | '폐활성탄' | '폐유';
export type MethodType = '소각' | '매립' | '재활용' | '에너지회수';

const WASTE: Record<WasteType, React.ReactNode> = {
  폐합성수지: (
    <>
      <path d="M9 3h6l-1 3h-4z" />
      <path d="M10 6C6.5 8 5 10.5 5 13 5 14.8 6.5 15.5 8.5 15.5h7c2 0 3.5-.7 3.5-2.5C19 10.5 17.5 8 14 6" />
      <circle cx="7" cy="20" r="1.25" />
      <circle cx="12" cy="20" r="1.25" />
      <circle cx="17" cy="20" r="1.25" />
    </>
  ),
  폐수처리오니: (
    <>
      <rect x="3" y="9" width="13" height="12" rx="2" />
      <path d="M3 13h13" />
      <path d="M3 17h13" />
      <path d="M19 3c1.2 1.3 2 2.4 2 3.5a2 2 0 0 1-4 0c0-1.1.8-2.2 2-3.5z" />
    </>
  ),
  폐활성탄: (
    <>
      <circle cx="12" cy="6.5" r="1.5" />
      <circle cx="9" cy="11.5" r="1.5" />
      <circle cx="15" cy="11.5" r="1.5" />
      <circle cx="6" cy="16.5" r="1.5" />
      <circle cx="12" cy="16.5" r="1.5" />
      <circle cx="18" cy="16.5" r="1.5" />
      <path d="M3 21h18" />
    </>
  ),
  폐유: (
    <>
      <path d="M13 5h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V9z" />
      <path d="M10 8 5 6" />
      <path d="M15 5v3h3V5" />
      <path d="M5 10.5c1.2 1.3 2 2.4 2 3.5a2 2 0 0 1-4 0c0-1.1.8-2.2 2-3.5z" />
    </>
  ),
};

const METHOD: Record<MethodType, React.ReactNode> = {
  소각: (
    <>
      <path d="M12 3s-6 5.5-6 11a6 6 0 0 0 12 0c0-5.5-6-11-6-11z" />
      <path d="M12 13s-2 2-2 3.5a2 2 0 0 0 4 0c0-1.5-2-3.5-2-3.5z" />
    </>
  ),
  매립: (
    <>
      <rect x="6" y="4" width="12" height="11" rx="2" />
      <path d="M3 8h18" />
      <path d="M4 18h8" />
      <path d="M12 21h8" />
    </>
  ),
  재활용: (
    <>
      <path d="M4 12a8 8 0 0 1 14.9-4" />
      <path d="M19.5 3.5V8H15" />
      <path d="M20 12a8 8 0 0 1-14.9 4" />
      <path d="M4.5 20.5V16H9" />
    </>
  ),
  // 번개 하나와 그 아래 열 파동 두 줄: 소각 불꽃과 구분되게 열을 에너지로
  에너지회수: (
    <>
      <path d="M15 2 7 10.5h5l-1 4.5 8-8.5h-5z" />
      <path d="M6 18.8c2-1.4 4-1.4 6 0s4 1.4 6 0" />
      <path d="M6 22c2-1.4 4-1.4 6 0s4 1.4 6 0" />
    </>
  ),
};

type BaseProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  size?: 'sm' | 'md';
  /** 글자 라벨이 옆에 없으면 넣는다. 없으면 장식(aria-hidden) */
  label?: string;
};

function Svg({ size = 'md', label, className, children, ...rest }: BaseProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={[styles.icon, styles[size], className].filter(Boolean).join(' ')}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function WasteIcon({ type, ...rest }: BaseProps & { type: WasteType }) {
  return <Svg {...rest}>{WASTE[type]}</Svg>;
}

export function MethodIcon({ type, ...rest }: BaseProps & { type: MethodType }) {
  return <Svg {...rest}>{METHOD[type]}</Svg>;
}

/** "잘 모르겠어요" 칩의 물음표(brand/icons/unknown.svg) */
export function UnknownIcon(props: BaseProps) {
  return (
    <Svg {...props}>
      <path d="M7.5 8.5a4.5 4.5 0 1 1 7.4 3.5c-1.8 1.2-2.9 2.1-2.9 4" />
      <circle cx="12" cy="20.5" r=".5" />
    </Svg>
  );
}

/** 버튼 오른쪽 화살표(Figma Button Arrow 벡터). 장식 전용 */
export function ArrowIcon(props: BaseProps) {
  return (
    <Svg {...props}>
      <path d="M4 12h15" />
      <path d="M13 6l6 6-6 6" />
    </Svg>
  );
}

export function MenuIcon(props: BaseProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </Svg>
  );
}

export function CloseIcon(props: BaseProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </Svg>
  );
}

export function CheckIcon(props: BaseProps) {
  return (
    <Svg {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}
