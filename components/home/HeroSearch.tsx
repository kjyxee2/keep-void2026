// 사업장 이름 검색(Figma Search Field 106:663, 열린 상태 120:512). ARIA combobox(1.2 패턴):
// 초점은 입력창에 두고 aria-activedescendant로 옵션을 가리킨다. 2자 이상, 250ms 디바운스, 결과 없음과 오류 상태.
// 고르면 /diagnose?factory=<id> 로 간다.
'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, searchFactories } from '@/lib/api-client';
import { AutocompleteList, optionId, type AutocompleteItem } from '@/components/ui/AutocompleteList';
import { SearchIcon } from './icons';
import styles from './HeroSearch.module.css';

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

type Status = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export function HeroSearch() {
  const router = useRouter();
  const uid = useId();
  const inputId = `${uid}-input`;
  const listId = `${uid}-list`;
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<AutocompleteItem[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number>(-1);
  const [retry, setRetry] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const q = query.trim();

  useEffect(() => {
    if (q.length < MIN_CHARS) {
      setStatus('idle');
      setItems([]);
      setActive(-1);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setStatus('loading');
      try {
        const res = await searchFactories(q, ctrl.signal);
        const next = res.factories.map((f) => ({
          id: f.id,
          name: f.name,
          dong: f.dong,
          wasteTypeCount: f.n_waste_types ?? f.waste_groups.length,
        }));
        setItems(next);
        setActive(-1);
        setStatus(next.length ? 'ready' : 'empty');
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') return;
        console.error('factory search:', e instanceof ApiError ? e.status : e);
        setItems([]);
        setStatus('error');
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, retry]);

  // 바깥을 누르면 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const showPanel = open && (status === 'ready' || status === 'empty' || status === 'error');
  const listOpen = open && status === 'ready';
  const activeItem = listOpen && active >= 0 ? items[active] : undefined;

  // 방향키로 고른 옵션이 목록 밖이면 보이게 스크롤(초점은 입력창에 그대로)
  useEffect(() => {
    if (!activeItem) return;
    document.getElementById(optionId(listId, activeItem.id))?.scrollIntoView({ block: 'nearest' });
  }, [activeItem, listId]);

  function select(item: AutocompleteItem) {
    setOpen(false);
    setQuery(item.name);
    router.push(`/diagnose?factory=${encodeURIComponent(item.id)}`);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'ArrowDown':
        if (status !== 'ready') return;
        e.preventDefault();
        setOpen(true);
        setActive((i) => (i + 1) % items.length);
        break;
      case 'ArrowUp':
        if (status !== 'ready') return;
        e.preventDefault();
        setOpen(true);
        setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
        break;
      case 'Enter':
        if (activeItem) {
          e.preventDefault();
          select(activeItem);
        } else if (status === 'error') {
          e.preventDefault();
          setRetry((n) => n + 1);
        }
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          setOpen(false);
          setActive(-1);
        } else if (query) {
          e.preventDefault();
          setQuery('');
        }
        break;
    }
  }

  // 스크린리더 알림: 결과 개수와 상태(목록 안 글자는 AutocompleteList가 읽힘)
  const announce =
    !open || q.length < MIN_CHARS
      ? ''
      : status === 'loading'
        ? '찾는 중이에요'
        : status === 'ready'
          ? `사업장 ${items.length}곳이 있어요. 위아래 방향키로 고르고 Enter를 누르세요`
          : status === 'empty'
            ? '신고 자료에 없는 사업장이에요'
            : status === 'error'
              ? '검색하지 못했어요. Enter를 누르면 다시 찾아요'
              : '';

  return (
    <div ref={wrapRef} className={styles.group} role="search">
      <label htmlFor={inputId} className={styles.caption}>
        또는 사업장 이름으로 찾기
      </label>
      <div className={styles.field}>
        <SearchIcon />
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={listOpen}
          aria-controls={listOpen ? listId : undefined}
          aria-activedescendant={activeItem ? optionId(listId, activeItem.id) : undefined}
          aria-busy={status === 'loading' || undefined}
          autoComplete="off"
          enterKeyHint="search"
          spellCheck={false}
          placeholder="사업장 이름 (예: 디와이코스메틱)"
          className={styles.input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </div>
      {showPanel && (
        <div className={styles.panel}>
          <AutocompleteList
            id={listId}
            items={items}
            activeId={activeItem?.id ?? null}
            status={status === 'ready' ? 'ready' : status === 'empty' ? 'empty' : 'error'}
            onSelect={select}
            onHover={(it) => setActive(items.findIndex((x) => x.id === it.id))}
          />
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
