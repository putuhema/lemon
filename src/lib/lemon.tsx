"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { glassDense } from "./glass";
import { flushOutbox } from "./offline";
import { haptic } from "./haptics";
import { applyTheme, getThemePref } from "./theme";
import type { Activity, LivePosition, Reader } from "./types";
import { NUDGES, type NudgeKind } from "./nudges";

type Toast = { id: number; text: string; action?: { label: string; href: string } };

type LemonState = {
  ready: boolean;
  session: Session | null;
  me: Reader | null;
  partner: Reader | null;
  notMember: boolean;
  /** Partner's live activity, or null when they don't have Lemon open. */
  partnerActivity: Activity | null;
  /** Partner's latest live page position (only while they're reading). */
  partnerLive: LivePosition | null;
  setActivity: (a: Activity) => void;
  sendPosition: (p: LivePosition) => void;
  /** Ping the partner. Resolves to a short message saying how it went. */
  nudge: (bookId: string | null, kind: NudgeKind) => Promise<string>;
  toast: (text: string, action?: Toast["action"]) => void;
  colorOf: (readerId: string) => string;
  nameOf: (readerId: string) => string;
};

export { NUDGES, type NudgeKind };

const Ctx = createContext<LemonState | null>(null);

export function useLemon() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLemon must be used inside <LemonProvider>");
  return v;
}

export function LemonProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loadedReaders, setLoadedReaders] = useState<{ userId: string; list: Reader[] } | null>(null);
  const [partnerActivity, setPartnerActivity] = useState<Activity | null>(null);
  const [partnerLive, setPartnerLive] = useState<LivePosition | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const activityRef = useRef<Activity>({ bookId: null, following: false });
  const partnerRef = useRef<Reader | null>(null);
  const partnerOnlineRef = useRef(false);

  const userId = session?.user.id ?? null;
  const readers = loadedReaders && loadedReaders.userId === userId ? loadedReaders.list : null;
  const me = readers?.find((r) => r.id === userId) ?? null;
  const partner = readers?.find((r) => r.id !== userId) ?? null;
  const notMember = !!session && readers !== null && !me;
  useEffect(() => {
    partnerRef.current = partner;
    partnerOnlineRef.current = !!partnerActivity;
  });

  const toast = useCallback((text: string, action?: Toast["action"]) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.filter((x) => x.text !== text).slice(-1), { id, text, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  // Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Service worker (notifications + "share to Lemon" on Android)
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        // In development the worker only handles notifications (see public/sw.js)
        .register(process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?dev", { scope: "/", updateViaCache: "none" })
        .catch(() => {});
    }
  }, []);

  // Dark mode: apply the saved choice, and follow the phone when set to "system"
  useEffect(() => {
    applyTheme();
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => getThemePref() === "system" && applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Send saves that were kept on the phone while offline
  useEffect(() => {
    if (!userId) return;
    flushOutbox();
    window.addEventListener("online", flushOutbox);
    return () => window.removeEventListener("online", flushOutbox);
  }, [userId]);

  // Redirects (the /features page is public)
  useEffect(() => {
    if (!authChecked || pathname === "/features") return;
    if (!session && pathname !== "/login") router.replace("/login");
    if (session && pathname === "/login") router.replace("/");
  }, [authChecked, session, pathname, router]);

  // The two readers
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("readers")
      .select("id,name,color")
      .order("created_at")
      .then(({ data }) => setLoadedReaders({ userId, list: data ?? [] }));
  }, [userId]);

  // Live channel: presence (who's online, in which book), page positions, nudges
  useEffect(() => {
    if (!me || !partner) return;
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase.channel("lemon:couple", {
        config: { private: true, presence: { key: me.id }, broadcast: { self: false } },
      });
      channelRef.current = channel;

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState<Activity & { at?: number }>();
          // A phone can show up more than once (e.g. after a reconnect): trust the newest update.
          const theirs = [...(state[partner.id] ?? [])].sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0];
          setPartnerActivity(
            theirs ? { bookId: theirs.bookId ?? null, following: !!theirs.following } : null,
          );
          if (!theirs?.bookId) setPartnerLive(null);
        })
        .on("broadcast", { event: "pos" }, ({ payload }) => {
          setPartnerLive(payload as LivePosition);
        })
        .on("broadcast", { event: "nudge" }, ({ payload }) => {
          const p = payload as { text: string; bookId: string | null };
          toast(`${partner.name} ${p.text}`, p.bookId ? { label: "Join", href: `/read?b=${p.bookId}&join=1` } : undefined);
          haptic("bump");
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") channel!.track({ ...activityRef.current, at: Date.now() });
        });
    })();

    // Re-announce when the app comes back to the foreground (phones pause sockets)
    const onVisible = () => {
      if (document.visibilityState === "visible") channelRef.current?.track({ ...activityRef.current, at: Date.now() });
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [me, partner, toast]);

  const setActivity = useCallback((a: Activity) => {
    activityRef.current = a;
    channelRef.current?.track({ ...a, at: Date.now() });
  }, []);

  const sendPosition = useCallback((p: LivePosition) => {
    channelRef.current?.send({ type: "broadcast", event: "pos", payload: p });
  }, []);

  const nudge = useCallback(
    async (bookId: string | null, kind: NudgeKind) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return "You’re signed out";
      if (!navigator.onLine) return "You’re offline";
      let title: string | undefined;
      if (bookId) {
        const { data: b } = await supabase.from("books").select("title").eq("id", bookId).single();
        title = b?.title;
      }
      // In-app, if they have Lemon open
      channelRef.current?.send({
        type: "broadcast",
        event: "nudge",
        payload: { text: NUDGES[kind].body(title), bookId },
      });
      // Phone notification
      const res = await fetch("/api/nudge", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookId, kind }),
      }).catch(() => null);
      const sent: number = res?.ok ? ((await res.json()).sent ?? 0) : 0;
      const name = partnerRef.current?.name ?? "They";
      if (sent > 0) return "Sent 💌";
      if (partnerOnlineRef.current) return "Sent 💌";
      return res?.ok
        ? `${name}’s notifications are off`
        : "Couldn’t send";
    },
    [],
  );

  const value = useMemo<LemonState>(
    () => ({
      ready: authChecked && (!session || readers !== null),
      session,
      me,
      partner,
      notMember,
      partnerActivity,
      partnerLive,
      setActivity,
      sendPosition,
      nudge,
      toast,
      colorOf: (id) => readers?.find((r) => r.id === id)?.color ?? "#F2C230",
      nameOf: (id) => readers?.find((r) => r.id === id)?.name ?? "Someone",
    }),
    [authChecked, session, readers, me, partner, notMember, partnerActivity, partnerLive, setActivity, sendPosition, nudge, toast],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+64px)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-in pointer-events-auto flex max-w-md items-center gap-3 rounded-full py-2 pr-2 pl-4 text-sm text-ink ${glassDense}`}
          >
            <span>{t.text}</span>
            {t.action && (
              <button
                className="shrink-0 rounded-full bg-lemon px-3 py-1.5 font-semibold text-on-lemon"
                onClick={() => {
                  setToasts((all) => all.filter((x) => x.id !== t.id));
                  router.push(t.action!.href);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
