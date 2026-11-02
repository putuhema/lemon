"use client";

/**
 * Small haptic feedback.
 * - Android: the Vibration API.
 * - iPhone: Safari has no vibration API, but since iOS 18 toggling a native switch
 *   (<input type="checkbox" switch>) plays the system haptic. We flip a hidden one.
 *   This only works during a tap, so on iPhone you feel your own actions, not incoming events.
 */

export type HapticKind = "tick" | "tap" | "success" | "bump";

const PATTERNS: Record<HapticKind, number | number[]> = {
  tick: 8,
  tap: 14,
  success: [12, 70, 18],
  bump: [22, 50, 22],
};

const KEY = "lemon-haptics";
let lastAt = 0;
let iosSwitch: HTMLLabelElement | null = null;

export const hapticsEnabled = () => typeof window !== "undefined" && localStorage.getItem(KEY) !== "off";
export const setHapticsEnabled = (on: boolean) => localStorage.setItem(KEY, on ? "on" : "off");

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function iosTick() {
  if (!iosSwitch) {
    iosSwitch = document.createElement("label");
    iosSwitch.setAttribute("aria-hidden", "true");
    iosSwitch.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;left:-10px;top:0";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    iosSwitch.append(input);
    document.body.append(iosSwitch);
  }
  iosSwitch.click();
}

/** Play a haptic. Quietly does nothing where it isn't supported or when turned off. */
export function haptic(kind: HapticKind = "tick") {
  if (typeof window === "undefined" || !hapticsEnabled()) return;
  lastAt = Date.now();
  if (typeof navigator.vibrate === "function" && !isIOS()) {
    navigator.vibrate(PATTERNS[kind]);
    return;
  }
  if (isIOS()) {
    iosTick();
    if (kind === "success" || kind === "bump") setTimeout(iosTick, 110);
  }
}

/** Milliseconds since the last haptic, to avoid doubling up (e.g. a tap that also turns a page). */
export const sinceLastHaptic = () => Date.now() - lastAt;
