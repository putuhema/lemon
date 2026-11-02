import { supabase } from "./supabase";

export const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function hasPushSubscription() {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return !!(await reg?.pushManager.getSubscription()) && Notification.permission === "granted";
}

/** Ask for notification permission and save this phone so your partner can ping it. */
export async function enablePush(readerId: string) {
  if (!pushSupported()) throw new Error("This browser can’t do notifications.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications were not allowed.");
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    }));
  const json = sub.toJSON();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ endpoint: json.endpoint!, reader_id: readerId, subscription: json });
  if (error) throw error;
}
