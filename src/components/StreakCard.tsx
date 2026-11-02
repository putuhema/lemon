"use client";

import type { Reader } from "@/lib/types";
import type { Streak } from "@/lib/streak";
import { LemonTree } from "./LemonTree";
import { BotHead, type BotMood } from "./BotHead";

const WEEKDAY = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "narrow" });

/** The couple's reading streak, drawn as a lemon tree that grows while you both keep reading. */
export function StreakCard({ streak, me, partner }: { streak: Streak; me: Reader; partner: Reader }) {
  const { current, best, meToday, partnerToday, week } = streak;
  const broken = current === 0 && best > 0;
  // Each face shows today: happy when you both read, waiting on the other, sleepy when the streak broke.
  const moodFor = (self: boolean, other: boolean): BotMood =>
    self ? (other ? "happy" : "waiting") : broken ? "sleepy" : "idle";

  return (
    <section className="flex items-center gap-2 rounded-3xl bg-paper p-3 pr-4 ring-1 ring-ink/5">
      <div className="-my-2 shrink-0">
        <LemonTree streak={current} size={96} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-serif text-3xl leading-none font-semibold tabular-nums">
            {current}
            <span className="ml-1 font-sans text-sm font-medium text-muted">{current === 1 ? "day" : "days"}</span>
          </p>
          <div className="flex items-end gap-2">
            <Today reader={me} mood={moodFor(meToday, partnerToday)} done={meToday} />
            <Today reader={partner} mood={moodFor(partnerToday, meToday)} done={partnerToday} />
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between">
          <div className="flex gap-1">
            {week.map((d) => {
              const both = d.me && d.partner;
              return (
                <div key={d.day} className="flex flex-col items-center gap-0.5">
                  <span
                    className={`grid size-5 place-items-center rounded-full text-[10px] ${
                      both ? "bg-lemon" : d.me || d.partner ? "bg-lemon/30" : "bg-ink/5"
                    }`}
                  >
                    {both ? "🍋" : ""}
                  </span>
                  <span className="text-[9px] text-muted">{WEEKDAY(d.day)}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted">
            Best <span className="font-semibold text-ink tabular-nums">{best}</span>
          </p>
        </div>
      </div>
    </section>
  );
}

function Today({ reader, mood, done }: { reader: Reader; mood: BotMood; done: boolean }) {
  return (
    <span className="relative">
      <BotHead color={reader.color} size={40} mood={mood} bob={mood === "happy"} label={reader.name} />
      {done && (
        <span className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full bg-leaf text-[10px] font-bold text-white">
          ✓
        </span>
      )}
    </span>
  );
}
