export const pct = (f: number | null | undefined) =>
  `${Math.round(Math.min(1, Math.max(0, f ?? 0)) * 100)}%`;

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const initial = (name?: string) => (name?.trim()[0] ?? "?").toUpperCase();
