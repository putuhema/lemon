"use client";

import type { Reader } from "@/lib/types";
import type { Streak } from "@/lib/streak";
import { LemonTree } from "./LemonTree";

const WEEKDAY = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "narrow" });

/** The couple's reading streak, drawn as a lemon tree that grows while you both keep reading. */
export function StreakCard({ streak, me, partner }: { streak: Streak; me: Reader; partner: Reader }) {
  const { current, best, meToday, partnerToday, week } = streak;

  return (
    <section className="flex items-center gap-2 rounded-3xl bg-paper p-3 pr-4 shadow-sm ring-1 ring-ink/5">
      <div className="-my-2 shrink-0">
        <LemonTree streak={current} size={96} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-serif text-3xl leading-none font-semibold tabular-nums">
            {current}
            <span className="ml-1 font-sans text-sm font-medium text-muted">{current === 1 ? "day" : "days"}</span>
          </p>
          <div className="flex gap-1.5 text-xs">
            <Today reader={me} done={meToday} label="You" />
            <Today reader={partner} done={partnerToday} label={partner.name} />
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

function Today({ reader, done, label }: { reader: Reader; done: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 ${done ? "text-ink" : "text-muted"}`}
      style={{ background: done ? reader.color + "55" : "rgba(46,42,31,.05)" }}
    >
      {done ? "✓" : "○"} {label}
    </span>
  );
}
