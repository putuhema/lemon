"use client";

import type { Reader } from "@/lib/types";
import { addDays, type Streak } from "@/lib/streak";
import { LemonTree } from "./LemonTree";

/** Monday first, two letters each ("Mo", "Tu", …) in the phone's language. */
const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  // 2024-01-01 was a Monday
  new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2),
);

/**
 * This month's reading days: a lemon on days you both read, a dot in your color on days only
 * one of you did. The streak and its lemon tree sit on top.
 */
export function MonthCalendar({ streak, me, partner }: { streak: Streak; me: Reader; partner: Reader }) {
  const { current, best, meToday, partnerToday, today, on } = streak;
  const [y, m] = today.split("-").map(Number);
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const daysInMonth = new Date(y, m, 0).getDate();
  // Blank cells before the 1st (Monday = 0)
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const monthName = new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const status =
    meToday && partnerToday
      ? "You both read today 🍋"
      : meToday
        ? `You read today · waiting on ${partner.name}`
        : partnerToday
          ? `${partner.name} read today · your turn`
          : current > 0
            ? "Read a few pages to keep it going"
            : "Read a few pages together to start a streak";

  return (
    <section className="rounded-3xl bg-paper p-4 ring-1 ring-ink/5">
      <div className="flex items-center gap-2">
        <div className="-my-3 -ml-2 shrink-0">
          <LemonTree streak={current} size={72} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-3xl leading-none font-semibold tabular-nums">
            {current}
            <span className="ml-1 font-sans text-sm font-medium text-muted">{current === 1 ? "day" : "days"}</span>
          </p>
          <p className="mt-1 truncate text-xs text-muted">{status}</p>
        </div>
        {best > current && <p className="shrink-0 self-start text-[11px] text-muted">Best {best}</p>}
      </div>

      <p className="mt-5 font-serif text-[17px] font-semibold">{monthName}</p>

      <div className="mt-2 grid grid-cols-7 gap-y-1 text-center" role="grid" aria-label={`Reading days in ${monthName}`}>
        {WEEKDAYS.map((d) => (
          <span key={d} className="pb-1 text-[10px] font-medium text-muted uppercase">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = addDays(first, i);
          const who = on(day);
          const both = who.me && who.partner;
          const isToday = day === today;
          const future = day > today;
          const label = both
            ? "you both read"
            : who.me
              ? `you read`
              : who.partner
                ? `${partner.name} read`
                : future
                  ? ""
                  : "no reading";
          return (
            <div key={day} role="gridcell" aria-label={`${i + 1}${label ? `, ${label}` : ""}`} className="flex flex-col items-center gap-0.5">
              <span
                className={`grid size-9 place-items-center rounded-full text-sm tabular-nums ${
                  both ? "bg-lemon font-semibold text-on-lemon" : future ? "text-muted/50" : ""
                } ${isToday ? "ring-2 ring-ink/70 ring-offset-2 ring-offset-paper" : ""}`}
              >
                {i + 1}
              </span>
              <span className="flex h-1.5 gap-0.5" aria-hidden>
                {!both && who.me && <span className="size-1.5 rounded-full" style={{ background: me.color }} />}
                {!both && who.partner && <span className="size-1.5 rounded-full" style={{ background: partner.color }} />}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-lemon" /> Both
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full" style={{ background: me.color }} /> {me.name}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full" style={{ background: partner.color }} /> {partner.name}
        </span>
      </div>
    </section>
  );
}
