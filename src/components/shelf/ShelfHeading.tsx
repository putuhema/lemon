import { PlusIcon } from "lucide-react";

/** A shelf's title, how many things are on it, and a + button to add one. */
export function ShelfHeading({
  title,
  count,
  addLabel,
  busy,
  onAdd,
}: {
  title: string;
  count?: string;
  addLabel: string;
  /** While something is being added: a short status ("Adding…", "40%") instead of the + */
  busy?: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <h2 className="font-serif text-xl font-semibold">{title}</h2>
        {count && <span className="text-sm text-muted">{count}</span>}
      </div>
      <button
        onClick={onAdd}
        disabled={!!busy}
        aria-label={busy ? `${addLabel}: ${busy}` : addLabel}
        className="flex h-9 min-w-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-lemon px-2.5 text-sm font-semibold text-on-lemon transition-transform active:scale-95 disabled:opacity-70"
      >
        {busy ? (
          <>
            <span className="size-3.5 animate-spin rounded-full border-2 border-on-lemon/25 border-t-on-lemon" />
            <span className="tabular-nums">{busy}</span>
          </>
        ) : (
          <PlusIcon className="size-5" strokeWidth={2.2} />
        )}
      </button>
    </div>
  );
}
