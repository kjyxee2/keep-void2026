'use client';
// 진단 3단계 사업장 찾기. ARIA combobox: 2자 이상, 250ms 뒤 검색, 위아래 화살표로 고르고 Enter, Esc로 닫기.
// 초점은 입력창에 두고 목록 항목은 aria-activedescendant로 가리킨다
import { useEffect, useId, useRef, useState } from 'react';
import { AutocompleteList, optionId, type AutocompleteItem } from '@/components/ui/AutocompleteList';
import { ApiError, searchFactories } from '@/lib/api-client';
import type { FactorySearchItem } from '@/lib/types';
import type { PickedFactory } from '@/lib/diagnose-state';
import styles from './Diagnose.module.css';

type Status = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export function FactorySearch({ onPick }: { onPick: (f: PickedFactory) => void }) {
  const uid = useId();
  const listId = `${uid}-list`;
  const helpId = `${uid}-help`;
  const [q, setQ] = useState('');
  const [items, setItems] = useState<FactorySearchItem[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = q.trim();
    abortRef.current?.abort();
    if (term.length < 2) {
      setItems([]);
      setStatus('idle');
      setActive(null);
      return;
    }
    const ac = new AbortController();
    abortRef.current = ac;
    setStatus('loading');
    const t = setTimeout(async () => {
      try {
        const res = await searchFactories(term.slice(0, 50), ac.signal);
        if (ac.signal.aborted) return;
        setItems(res.factories);
        setStatus(res.factories.length ? 'ready' : 'empty');
        setActive(res.factories[0]?.id ?? null);
        setOpen(true);
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setItems([]);
        setStatus('error');
        setMessage(e instanceof ApiError && e.status !== 500 ? e.message : '잠시 뒤 다시 찾아 주세요.');
        setOpen(true);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [q]);

  function choose(id: string) {
    const f = items.find((x) => x.id === id);
    if (!f) return;
    setOpen(false);
    onPick({
      id: f.id,
      name: f.name,
      address: f.address,
      dong: f.dong,
      coord_verified: f.coord_verified === true ? true : f.coord_verified === false ? false : null,
      n_waste_types: f.n_waste_types,
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
      return;
    }
    if (status !== 'ready') return;
    const idx = items.findIndex((x) => x.id === active);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      const next = e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
      setActive(items[next]?.id ?? null);
    } else if (e.key === 'Enter' && open && active) {
      e.preventDefault();
      choose(active);
    }
  }

  const listItems: AutocompleteItem[] = items.map((f) => ({
    id: f.id,
    name: f.name,
    dong: f.dong,
    wasteTypeCount: f.n_waste_types ?? f.waste_groups.length,
  }));
  const expanded = open && (status === 'ready' || status === 'empty' || status === 'error');
  const live =
    status === 'loading' ? '찾는 중이에요'
    : status === 'ready' ? `사업장 ${items.length}곳을 찾았어요. 위아래 화살표로 고르고 Enter를 눌러 주세요.`
    : status === 'empty' ? '신고 자료에서 찾지 못했어요.'
    : status === 'error' ? message
    : '';

  return (
    <div className={styles.search}>
      <label htmlFor={`${uid}-input`} className={styles.fieldLabel}>
        사업장 이름 또는 주소
      </label>
      <div className={styles.searchField}>
        <svg viewBox="0 0 24 24" className={styles.searchIcon} aria-hidden="true" focusable="false" fill="none"
          stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </svg>
        <input
          id={`${uid}-input`}
          className={styles.searchInput}
          type="search"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && status === 'ready' && active ? optionId(listId, active) : undefined}
          aria-describedby={helpId}
          autoComplete="off"
          maxLength={50}
          placeholder="예: 디와이코스메틱"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
        />
      </div>
      <p id={helpId} className={styles.fieldHelp}>
        신고 자료에 있는 사업장 이름이나 도로명 주소로 찾아요. 두 글자부터 찾아요.
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {live}
      </p>
      {expanded && (
        <div className={styles.searchPanel}>
          {status === 'ready' ? (
            <AutocompleteList id={listId} items={listItems} activeId={active} onSelect={(it) => choose(it.id)}
              onHover={(it) => setActive(it.id)} />
          ) : (
            <p id={listId} className={styles.searchMessage}>
              {status === 'empty'
                ? '신고 자료에서 찾지 못했어요. 이름을 줄여 찾거나 사업장 없이 결과를 볼 수 있어요.'
                : message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
