export type NudgeKind = "read" | "goodnight" | "miss";

export const NUDGES: Record<NudgeKind, { label: string; body: (book?: string) => string }> = {
  read: {
    label: "Read with me? 🍋",
    body: (b) => (b ? `wants to read “${b}” with you right now` : "wants to read with you"),
  },
  goodnight: {
    label: "Goodnight read? 🌙",
    body: (b) => (b ? `is up for a bedtime chapter of “${b}”` : "is up for a bedtime chapter"),
  },
  miss: { label: "Thinking of you 💛", body: () => "is thinking of you" },
};
