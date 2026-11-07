// 모바일 메뉴 시트: <dialog>로 초점 가둠, Esc 닫기, 닫으면 메뉴 버튼으로 초점 복귀
'use client';
import { useRef } from 'react';
import { CloseIcon, MenuIcon } from '@/components/brand/Icon';
import { NavLinks } from './NavLinks';
import styles from './Header.module.css';

export function MobileMenu() {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();

  return (
    <>
      <button
        type="button"
        className={styles.menuButton}
        aria-haspopup="dialog"
        aria-controls="mobile-menu"
        onClick={() => dialog.current?.showModal()}
      >
        <MenuIcon />
        <span className="sr-only">메뉴 열기</span>
      </button>
      <dialog
        id="mobile-menu"
        ref={dialog}
        className={styles.sheet}
        aria-label="메뉴"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className={styles.sheetInner}>
          <button type="button" className={styles.menuButton} onClick={close}>
            <CloseIcon />
            <span className="sr-only">메뉴 닫기</span>
          </button>
          <nav aria-label="주 메뉴">
            <NavLinks className={styles.sheetLinks} linkClassName={styles.sheetLink} onNavigate={close} />
          </nav>
        </div>
      </dialog>
    </>
  );
}
