import { BotHead } from "@/components/BotHead";
import { pct } from "@/lib/format";

/** One reader's progress: their bot, a bar in their color, and the percentage. */
export function Bar({ color, label, value }: { color: string; label: string; value?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <BotHead color={color} size={20} label={label} />
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/8">
        <div className="h-full rounded-full" style={{ width: pct(value), background: color }} />
      </div>
      <span className="w-8 text-right text-[10px] tabular-nums text-muted">{value ? pct(value) : "–"}</span>
    </div>
  );
}
