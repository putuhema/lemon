export type ThemeName = "paper" | "sepia" | "night";
export type FontChoice = "book" | "serif" | "sans";
export type Prefs = { theme: ThemeName; size: number; font: FontChoice };

export const THEMES: Record<ThemeName, { label: string; bg: string; fg: string; muted: string; link: string; chrome: string }> = {
  paper: { label: "Paper", bg: "#FFFDF5", fg: "#2E2A1F", muted: "#9a917e", link: "#8a6a00", chrome: "#FFFDF5" },
  sepia: { label: "Sepia", bg: "#F3E9D2", fg: "#4A3B27", muted: "#9b8a6c", link: "#7b5a14", chrome: "#F3E9D2" },
  night: { label: "Night", bg: "#1C1A16", fg: "#D8CFBC", muted: "#7f776a", link: "#E5C55A", chrome: "#26231c" },
};

export const DEFAULT_PREFS: Prefs = { theme: "paper", size: 100, font: "book" };

const FAMILIES: Record<Exclude<FontChoice, "book">, string> = {
  serif: `ui-serif, "New York", "Iowan Old Style", Georgia, serif`,
  sans: `ui-sans-serif, -apple-system, system-ui, "Segoe UI", Roboto, sans-serif`,
};

/** CSS injected into the book pages. */
export function bookCSS(p: Prefs) {
  const t = THEMES[p.theme];
  const night = p.theme === "night";
  const family = p.font === "book" ? null : FAMILIES[p.font];
  return `
@namespace epub "http://www.idpf.org/2007/ops";
html {
  color-scheme: light; /* keeps the page see-through so the app's theme color shows */
  color: ${t.fg} !important;
  background: transparent !important; /* the app paints the page color, so theme switches apply everywhere */
  font-size: ${p.size}% !important;
  -webkit-text-size-adjust: none;
}
body { color: inherit !important; background: transparent !important; }
${night ? `body * { color: inherit !important; background-color: transparent !important; border-color: #3a362e !important; }
img { filter: brightness(.85); }` : ""}
a:link, a:visited { color: ${t.link} !important; }
p, li, blockquote, dd {
  line-height: 1.6;
  -webkit-hyphens: auto;
  hyphens: auto;
  widows: 2;
  orphans: 2;
}
${family ? `body, p, li, blockquote, dd, div, span, em, i, b, strong { font-family: ${family} !important; }` : ""}
img, svg { max-width: 100%; }
pre { white-space: pre-wrap !important; }
::selection { background: rgba(245, 203, 46, .45); }
aside[epub|type~="endnote"], aside[epub|type~="footnote"],
aside[epub|type~="note"], aside[epub|type~="rearnote"] { display: none; }
`;
}
