"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LayoutGroup, motion, MotionConfig, type Transition } from "motion/react";
import { BookOpenTextIcon, LibraryBigIcon, PlusIcon, type LucideIcon } from "lucide-react";
import { glass } from "@/lib/glass";

const spring: Transition = { type: "spring", stiffness: 520, damping: 40 };

/** The header: a floating glass pill. Pages scroll under it. */
export function TopBar({ children }: { children: ReactNode }) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 px-3 pt-[calc(env(safe-area-inset-top)+8px)]">
      <div className={`pointer-events-auto mx-auto flex h-12 max-w-2xl items-center gap-1.5 rounded-full pr-1.5 pl-3 ${glass}`}>
        {children}
      </div>
    </header>
  );
}

type Item =
  | { id: string; label: string; icon: LucideIcon; href: string | null }
  | { id: string; label: string; icon: LucideIcon; onClick: () => void; busy?: boolean };

/** The floating bottom nav, with a highlight that slides to the active tab. */
export function FloatingNav({ items, active }: { items: Item[]; active: string }) {
  return (
    <MotionConfig reducedMotion="user" transition={spring}>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <LayoutGroup>
          <nav aria-label="Navigation" className={`pointer-events-auto flex items-center rounded-full p-1 ${glass}`}>
            {items.map((item) => (
              <NavItem key={item.id} item={item} active={active === item.id} />
            ))}
          </nav>
        </LayoutGroup>
      </div>
    </MotionConfig>
  );
}

function NavItem({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  const busy = "busy" in item && item.busy;
  const disabled = "href" in item && !item.href;
  const body = (
    <>
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 rounded-full bg-ink/[0.07]"
        />
      )}
      {busy ? (
        <span className="relative size-5 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
      ) : (
        <Icon className="relative size-5" strokeWidth={active ? 2.2 : 1.8} />
      )}
      <span className="relative text-[10.5px] leading-none">{item.label}</span>
    </>
  );
  const className = `relative flex h-12 w-[72px] flex-col items-center justify-center gap-1 rounded-full transition-colors ${
    active ? "text-ink" : "text-muted hover:text-ink"
  } ${disabled ? "pointer-events-none opacity-40" : ""}`;

  return (
    <motion.div whileTap={{ scale: 0.92 }}>
      {"href" in item ? (
        item.href ? (
          <Link href={item.href} aria-current={active ? "page" : undefined} className={className}>
            {body}
          </Link>
        ) : (
          <span className={className} aria-disabled="true">
            {body}
          </span>
        )
      ) : (
        <button type="button" onClick={item.onClick} disabled={busy} className={className}>
          {body}
        </button>
      )}
    </motion.div>
  );
}

export { BookOpenTextIcon, LibraryBigIcon, PlusIcon };
