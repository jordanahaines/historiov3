"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TopNavProps = { initial: string };

// Pages that don't exist yet render as muted labels, not dead links.
const MUTED_ITEMS = ["Map & Timeline"];
const MUTED_AFTER = ["Boards", "Sync"];

const itemClass = "px-3 py-1.5 text-sm";

export function TopNav({ initial }: TopNavProps) {
  const pathname = usePathname();
  const libraryActive = pathname.startsWith("/library");

  return (
    <header className="border-border bg-panel sticky top-0 z-30 flex h-[var(--nav-h)] items-center justify-between border-b px-6">
      <div className="flex items-center gap-6">
        <span className="font-serif text-2xl font-semibold">Historio</span>
        <nav aria-label="Main" className="flex items-center gap-1">
          {MUTED_ITEMS.map((label) => (
            <span
              key={label}
              aria-disabled="true"
              className={`${itemClass} text-ink-muted`}
            >
              {label}
            </span>
          ))}
          <Link
            href="/library"
            aria-current={libraryActive ? "page" : undefined}
            className={`${itemClass} text-ink focus-visible:outline-link focus-visible:outline-2 ${
              libraryActive ? "bg-wash" : "hover:bg-wash/60"
            }`}
          >
            Library
          </Link>
          {MUTED_AFTER.map((label) => (
            <span
              key={label}
              aria-disabled="true"
              className={`${itemClass} text-ink-muted`}
            >
              {label}
            </span>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <span aria-disabled="true" className="text-ink-muted text-sm">
          Account
        </span>
        <span
          aria-label="Your profile"
          className="bg-ink text-paper flex size-8 items-center justify-center rounded-full text-sm font-medium"
        >
          {initial}
        </span>
      </div>
    </header>
  );
}
