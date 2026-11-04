"use client";

import { CloudOffIcon } from "lucide-react";
import { useLemon } from "@/lib/lemon";
import { useOffline } from "@/lib/offline";
import { useStreak } from "@/lib/streak";
import { NotMember, Splash } from "@/components/Gate";
import { FridgeNote } from "@/components/FridgeNote";
import { MonthCalendar } from "@/components/MonthCalendar";
import { RightNow } from "@/components/RightNow";
import { MomentFromUs } from "@/components/MomentFromUs";
import { AppNav } from "@/components/AppNav";

/** Home: the note on the fridge, your partner right now, this month's reading, and a moment from before. */
export default function Home() {
  const { ready, me, partner, notMember } = useLemon();
  const offline = useOffline();
  const streak = useStreak(me?.id, partner?.id);

  if (!ready || !me) return notMember ? <NotMember /> : <Splash />;

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 pt-[calc(env(safe-area-inset-top)+20px)] pb-[calc(env(safe-area-inset-bottom)+104px)]">
      {offline && (
        <p className="mb-3 flex items-center justify-center gap-1.5 text-xs font-medium text-muted" role="status">
          <CloudOffIcon className="size-3.5" /> Offline
        </p>
      )}

      <div className="pt-2">
        <FridgeNote />
      </div>

      <div className="mt-4">
        <RightNow />
      </div>

      <div className="mt-4">
        {streak && partner ? (
          <MonthCalendar streak={streak} me={me} partner={partner} />
        ) : (
          <div className="h-[430px] animate-pulse rounded-3xl bg-ink/5" />
        )}
      </div>

      <div className="mt-4">
        <MomentFromUs />
      </div>

      <AppNav active="home" />
    </main>
  );
}
