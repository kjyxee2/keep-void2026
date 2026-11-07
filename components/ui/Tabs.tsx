// Figma Tabs(143:98): ARIA tablist. 좌우 화살표, Home, End. 선택 표시는 즉시, 패널 내용만 150ms 나타남
// 비제어(defaultId) 또는 제어(value + onChange) 모드. 제어 모드면 선택은 밖(주소 ?tab= 등)이 정한다.
'use client';
import { useId, useRef, useState, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import styles from './Tabs.module.css';

export type TabItem = { id: string; label: string; content: ReactNode };

export function Tabs({
  items,
  defaultId,
  value,
  onChange,
  label,
  idBase,
  listProps,
  panelClassName,
}: {
  items: TabItem[];
  defaultId?: string;
  /** 제어 모드: 선택된 탭 id */
  value?: string;
  onChange?: (id: string) => void;
  label: string;
  /** 탭, 패널 id 접두사(주소나 인쇄 CSS에서 가리킬 때). 없으면 useId */
  idBase?: string;
  /** tablist에 더 붙일 속성(인쇄 숨김 data 속성 등) */
  listProps?: HTMLAttributes<HTMLDivElement> & { [key: `data-${string}`]: string | undefined };
  panelClassName?: string;
}) {
  const autoBase = useId();
  const base = idBase ?? autoBase;
  const [inner, setInner] = useState(defaultId ?? items[0]?.id);
  const active = value ?? inner;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (id: string) => {
    if (value === undefined) setInner(id);
    onChange?.(id);
  };

  const move = (to: number) => {
    const i = (to + items.length) % items.length;
    select(items[i].id);
    refs.current[i]?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const map: Record<string, () => void> = {
      ArrowRight: () => move(i + 1),
      ArrowLeft: () => move(i - 1),
      Home: () => move(0),
      End: () => move(items.length - 1),
    };
    if (map[e.key]) {
      e.preventDefault();
      map[e.key]();
    }
  };

  return (
    <div className={styles.tabs}>
      <div role="tablist" aria-label={label} {...listProps} className={[styles.list, listProps?.className].filter(Boolean).join(' ')}>
        {items.map((t, i) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              className={styles.tab}
              onClick={() => select(t.id)}
              onKeyDown={(e) => onKey(e, i)}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {items.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${base}-panel-${t.id}`}
          aria-labelledby={`${base}-tab-${t.id}`}
          hidden={t.id !== active}
          tabIndex={0}
          className={[styles.panel, 'tab-fade-in', panelClassName].filter(Boolean).join(' ')}
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
