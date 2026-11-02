import { BotHead, type BotMood } from "./BotHead";

export type Peek = { key: number; color: string; mood: BotMood; side: "left" | "right"; label?: string };

/** A bot that peeks in from the edge of the page for a moment. */
export function PeekBot({ peek }: { peek: Peek }) {
  const right = peek.side === "right";
  return (
    <div
      key={peek.key}
      aria-live="polite"
      className={`pointer-events-none absolute z-30 ${right ? "peek-right right-0" : "peek-left left-0"}`}
      style={{ top: "38%" }}
    >
      <BotHead color={peek.color} size={76} mood={peek.mood} label={peek.label} />
    </div>
  );
}
