"use client";

import { Suspense } from "react";
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

  if (!ready || !me) return notMember ? <NotMember /> : <Splash />;

  const choose = (next: Tab) => {
    if (next === tab) return;
    haptic("tick");
    router.replace(next === "journals" ? "/reading?tab=journals" : "/reading", { scroll: false });
  };

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 pt-[calc(env(safe-area-inset-top)+20px)] pb-[calc(env(safe-area-inset-bottom)+104px)]">
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

      {/* Both stay mounted, so an upload keeps going if you switch over */}
      <section id="shelf-books" role="tabpanel" hidden={tab !== "books"} className="mt-6">
        <BookShelf />
      </section>
      <section id="shelf-journals" role="tabpanel" hidden={tab !== "journals"} className="mt-6">
        <JournalShelf />
      </section>

      <AppNav active="reading" />
    </main>
  );
}
