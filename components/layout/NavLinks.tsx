'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV } from './nav';

export function NavLinks({ className, linkClassName, onNavigate }: { className?: string; linkClassName?: string; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <ul role="list" className={className}>
      {NAV.map((n) => (
        <li key={n.href}>
          <Link
            href={n.href}
            className={linkClassName}
            aria-current={path === n.href || path.startsWith(n.href + '/') ? 'page' : undefined}
            onClick={onNavigate}
          >
            {n.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
