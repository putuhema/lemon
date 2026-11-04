"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CloudOffIcon } from "lucide-react";
import { LayoutGroup, motion, MotionConfig } from "motion/react";
import { useLemon } from "@/lib/lemon";
import { useOffline } from "@/lib/offline";
import { haptic } from "@/lib/haptics";
import { NotMember, Splash } from "@/components/Gate";
import { AppNav } from "@/components/AppNav";
import { BookShelf } from "@/components/shelf/BookShelf";
import { JournalShelf } from "@/components/shelf/JournalShelf";

type Tab = "books" | "journals";

export default function ReadingPage() {
  return (
    <Suspense>
      <Reading />
    </Suspense>
  );
}

/** Everything you read together: books, or journals and articles, one switch apart. */
function Reading() {
  const { ready, me, notMember } = useLemon();
  const router = useRouter();
  const params = useSearchParams();
  const offline = useOffline();
  const tab: Tab = params.get("tab") === "journals" ? "journals" : "books";
  const mainRef = useRef<HTMLElement>(null);

  // Swipe left or right anywhere on the page to switch between Books and Journals
  const shown = ready && !!me;
  useEffect(() => {
    const el = mainRef.current;
    if (!shown || !el) return;
    let start: { x: number; y: number; t: number } | null = null;

    const onStart = (e: TouchEvent) => {
      start = null;
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      // Leave the screen edges to the browser's own back/forward swipe
      if (touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return;
      if (!swipeable(e.target, el)) return;
      start = { x: touch.clientX, y: touch.clientY, t: e.timeStamp };
    };
    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const quick = e.timeStamp - start.t < 600;
      start = null;
      if (!quick || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
      const next: Tab = dx < 0 ? "journals" : "books";
      if (next === tab) return;
      haptic("tick");
      router.replace(next === "journals" ? "/reading?tab=journals" : "/reading", { scroll: false });
    };
    const onCancel = () => (start = null);

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
  }, [shown, tab, router]);

  if (!ready || !me) return notMember ? <NotMember /> : <Splash />;

  const choose = (next: Tab) => {
    if (next === tab) return;
    haptic("tick");
    router.replace(next === "journals" ? "/reading?tab=journals" : "/reading", { scroll: false });
  };

  return (
    <main ref={mainRef} className="mx-auto min-h-dvh overflow-x-clip max-w-2xl px-5 pt-[calc(env(safe-area-inset-top)+20px)] pb-[calc(env(safe-area-inset-bottom)+104px)]">
      {offline && (
        <p className="mb-3 flex items-center justify-center gap-1.5 text-xs font-medium text-muted" role="status">
          <CloudOffIcon className="size-3.5" /> Offline
        </p>
      )}

      <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 520, damping: 40 }}>
        <LayoutGroup id="reading-tabs">
          <div role="tablist" aria-label="What to read" className="grid grid-cols-2 rounded-full bg-ink/5 p-1 text-sm font-semibold">
            {(
              [
                ["books", "Books"],
                ["journals", "Journals & articles"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                aria-controls={`shelf-${id}`}
                onClick={() => choose(id)}
                className={`relative rounded-full py-2.5 transition-colors ${tab === id ? "text-ink" : "text-muted"}`}
              >
                {tab === id && <motion.span layoutId="reading-tab" className="absolute inset-0 rounded-full bg-paper ring-1 ring-ink/5" />}
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>
        </LayoutGroup>
      </MotionConfig>

      {/* Both stay mounted, so an upload keeps going if you switch over.
          Each slides in from its own side: Books from the left, Journals from the right. */}
      <MotionConfig reducedMotion="user">
        <motion.section
          id="shelf-books"
          role="tabpanel"
          hidden={tab !== "books"}
          initial={false}
          animate={tab === "books" ? { opacity: 1, x: 0 } : { opacity: 0, x: -28 }}
          transition={{ type: "spring", stiffness: 420, damping: 38 }}
          className="mt-6"
        >
          <BookShelf />
        </motion.section>
        <motion.section
          id="shelf-journals"
          role="tabpanel"
          hidden={tab !== "journals"}
          initial={false}
          animate={tab === "journals" ? { opacity: 1, x: 0 } : { opacity: 0, x: 28 }}
          transition={{ type: "spring", stiffness: 420, damping: 38 }}
          className="mt-6"
        >
          <JournalShelf />
        </motion.section>
      </MotionConfig>

      <AppNav active="reading" />
    </main>
  );
}

/** A swipe counts only on the page itself: not in sheets, the nav, text fields, or anything that scrolls sideways. */
function swipeable(target: EventTarget | null, root: HTMLElement) {
  for (let node = target as HTMLElement | null; node && node !== root; node = node.parentElement) {
    if (node.matches("input, textarea, select, [contenteditable=true], [role=dialog]")) return false;
    const style = getComputedStyle(node);
    if (style.position === "fixed") return false;
    if (/(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth) return false;
  }
  return true;
}
