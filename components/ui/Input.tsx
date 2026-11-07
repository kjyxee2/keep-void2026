// Figma Input(71:35): 라벨, 값, 단위 칸, 도움말, 오류. 상태 Default, Focus, Error(+ Hover, Disabled)
'use client';
import { useId, type InputHTMLAttributes } from 'react';
import styles from './Input.module.css';

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label: string;
  unit?: string;
  helper?: string;
  /** 있으면 오류 상태. 칸 바로 아래에 보이고 스크린리더가 읽는다 */
  error?: string;
};

export function Input({ label, unit, helper, error, id, className, ...input }: InputProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const helpId = `${inputId}-help`;
  const errId = `${inputId}-error`;
  const describedBy = [error ? errId : helper ? helpId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={[styles.wrap, error && styles.invalid, className].filter(Boolean).join(' ')}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <div className={styles.field}>
        <input
          id={inputId}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...input}
        />
        {unit && (
          <span className={styles.unit} aria-hidden="true">
            {unit}
          </span>
        )}
      </div>
      {error ? (
        <p id={errId} className={styles.error} role="alert">
          {error}
        </p>
      ) : (
        helper && (
          <p id={helpId} className={styles.helper}>
            {helper}
          </p>
        )
      )}
    </div>
  );
}
