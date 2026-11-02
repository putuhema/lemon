/** Light or dark: follows the phone by default, or what you picked in your profile. */
export type ThemePref = "system" | "light" | "dark";

const KEY = "lemon-theme";
const BAR = { light: "#FFF8E1", dark: "#16140F" };

export const getThemePref = (): ThemePref => (localStorage.getItem(KEY) as ThemePref) ?? "system";

export const isDark = () =>
  document.documentElement.classList.contains("dark");

/** The status bar color for the current mode. */
export const barColor = () => (isDark() ? BAR.dark : BAR.light);

export function applyTheme(pref: ThemePref = getThemePref()) {
  const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? BAR.dark : BAR.light);
}

export function setThemePref(pref: ThemePref) {
  localStorage.setItem(KEY, pref);
  applyTheme(pref);
}

/** Runs before the page paints, so dark mode never flashes light first. */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem("${KEY}")||"system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");document.addEventListener("DOMContentLoaded",function(){var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d?"${BAR.dark}":"${BAR.light}")});}catch(e){}})();`;
