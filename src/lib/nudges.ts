export type NudgeKind = "read" | "goodnight" | "miss";

export const NUDGES: Record<NudgeKind, { label: string; body: (book?: string) => string }> = {
  read: {
    label: "Read with me? 🍋",
    body: (b) => (b ? `wants to read “${b}” with you` : "wants to read with you"),
  },
  goodnight: {
    label: "Goodnight read? 🌙",
    body: () => "wants a bedtime chapter"
  },
  miss: { label: "Thinking of you 💛", body: () => "is thinking of you" },
};
