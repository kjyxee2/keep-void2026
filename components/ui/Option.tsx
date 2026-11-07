// Figma Option(70:94): 선택 칩. 진짜 radio/checkbox를 써서 Tab, 방향키, Space가 기본으로 동작
import type { InputHTMLAttributes, ReactNode } from 'react';
import { CheckIcon } from '@/components/brand/Icon';
import styles from './Option.module.css';

export type OptionProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> & {
  /** radio: 하나만 고름(기본), checkbox: 여러 개 */
  type?: 'radio' | 'checkbox';
  /** 아이콘 슬롯(WasteIcon, MethodIcon). 글자 라벨과 같이 쓴다 */
  icon?: ReactNode;
  children: ReactNode;
  fullWidth?: boolean;
};

export function Option({ type = 'radio', icon, children, className, fullWidth, ...input }: OptionProps) {
  return (
    <label className={[styles.option, fullWidth && styles.full, className].filter(Boolean).join(' ')}>
      <input type={type} className={styles.input} {...input} />
      <span className={styles.check} aria-hidden="true">
        <CheckIcon size="sm" className={styles.mark} />
      </span>
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.label}>{children}</span>
    </label>
  );
}
