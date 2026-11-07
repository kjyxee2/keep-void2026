// 홈 전용 장식 아이콘(Figma Icon/Search 106:664, 버튼의 서류 스캔 아이콘). 글자 라벨이 항상 옆에 있어 aria-hidden
import styles from './icons.module.css';

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.icon}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function ScanIcon() {
  return (
    <Svg>
      <path d="M4 8V5a1 1 0 0 1 1-1h3" />
      <path d="M16 4h3a1 1 0 0 1 1 1v3" />
      <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
      <path d="M8 20H5a1 1 0 0 1-1-1v-3" />
      <path d="M8 9h8" />
      <path d="M8 12h8" />
      <path d="M8 15h5" />
    </Svg>
  );
}

export function SearchIcon() {
  return (
    <Svg>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 20 20" />
    </Svg>
  );
}

export function PauseIcon() {
  return (
    <Svg>
      <path d="M8 5v14" />
      <path d="M16 5v14" />
    </Svg>
  );
}

export function PlayIcon() {
  return (
    <Svg>
      <path d="M7 4.5v15l12-7.5z" />
    </Svg>
  );
}
