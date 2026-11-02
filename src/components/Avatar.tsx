import type { Reader } from "@/lib/types";
import { initial } from "@/lib/format";

export function Avatar({ reader, size = 32, ring }: { reader: Reader; size?: number; ring?: boolean }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-semibold text-ink/85 ${ring ? "ring-2 ring-white" : ""}`}
      style={{ width: size, height: size, background: reader.color, fontSize: size * 0.42 }}
      aria-label={reader.name}
    >
      {initial(reader.name)}
    </span>
  );
}
