// Figma Search/Autocomplete(119:74) 목록 부분. 입력창(combobox)과 키보드 처리는 홈 검색(Task 7)에서 붙인다
// 실제 초점은 입력창에 두고 activeId를 입력창 aria-activedescendant에 넣는다
import styles from './AutocompleteList.module.css';

export type AutocompleteItem = { id: string; name: string; dong: string | null; wasteTypeCount: number };

export function optionId(listId: string, itemId: string) {
  return `${listId}-opt-${itemId}`;
}

export function AutocompleteList({
  id,
  items,
  activeId,
  status = 'ready',
  onSelect,
  onHover,
}: {
  id: string;
  items: AutocompleteItem[];
  activeId?: string | null;
  status?: 'ready' | 'empty' | 'error';
  onSelect?: (item: AutocompleteItem) => void;
  onHover?: (item: AutocompleteItem) => void;
}) {
  if (status !== 'ready') {
    return (
      <div className={styles.panel}>
        <p className={styles.message} aria-live="polite">
          {status === 'empty' ? '신고 자료에 없는 사업장이에요. 폐기물 종류로 찾아 주세요.' : '잠시 뒤 다시 시도해 주세요.'}
        </p>
      </div>
    );
  }
  return (
    <ul id={id} role="listbox" aria-label="사업장 검색 결과" className={styles.panel}>
      {items.map((it) => {
        const active = it.id === activeId;
        return (
          // 옵션은 입력창의 aria-activedescendant로 고른다. 마우스 클릭은 보조 수단
          <li
            key={it.id}
            id={optionId(id, it.id)}
            role="option"
            aria-selected={active}
            className={styles.item}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect?.(it)}
            onMouseEnter={() => onHover?.(it)}
          >
            <span className={styles.name}>{it.name}</span>
            <span className={styles.meta}>
              {it.dong && <span>{it.dong}</span>}
              <span>신고된 폐기물 {it.wasteTypeCount}종</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
