import Link from "next/link";
import { BookOpenTextIcon } from "lucide-react";
import type { Book, Progress, Reader } from "@/lib/types";
import { pct } from "@/lib/format";
import { BotHead } from "./BotHead";

/** The book you were last reading, one tap from where you left off. */
export function ContinueCard({
  book,
  cover,
  mine,
  theirs,
  me,
  partner,
}: {
  book: Book;
  cover?: string;
  mine: Progress;
  theirs?: Progress;
  me: Reader;
  partner: Reader | null;
}) {
  return (
    <Link
      href={`/read?b=${book.id}`}
      className="flex items-center gap-3.5 rounded-3xl bg-paper p-3 ring-1 ring-ink/5 transition-transform active:scale-[0.98]"
    >
      {cover ? (
        <img src={cover} alt="" className="h-20 w-14 shrink-0 rounded-lg object-cover ring-1 ring-ink/5" />
      ) : (
        <div className="h-20 w-14 shrink-0 rounded-lg bg-gradient-to-br from-lemon to-lemon-deep" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-[16px] font-semibold leading-snug">{book.title}</p>
        <p className="truncate text-xs text-muted">
          {mine.chapter ?? book.author} · {pct(mine.fraction)}
        </p>
        <div className="relative mt-3.5 h-1.5 rounded-full bg-ink/8">
          <div className="h-full rounded-full" style={{ width: pct(mine.fraction), background: me.color }} />
          {partner && theirs && (
            <span
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: pct(theirs.fraction) }}
              title={`${partner.name} · ${pct(theirs.fraction)}`}
            >
              <BotHead color={partner.color} size={20} />
            </span>
          )}
        </div>
      </div>
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-lemon text-ink" aria-label="Continue reading">
        <BookOpenTextIcon className="size-5" />
      </span>
    </Link>
  );
}
