"use client";

import { useEffect, useState } from "react";
import { useLemon } from "@/lib/lemon";
import { supabase } from "@/lib/supabase";
import { haptic, hapticsEnabled, setHapticsEnabled } from "@/lib/haptics";
import { getThemePref, setThemePref, type ThemePref } from "@/lib/theme";
import { enablePush, hasPushSubscription, isIOS, isStandalone, pushSupported } from "@/lib/push";
import { Sheet } from "@/components/Sheet";

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, toast } = useLemon();
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const [hapticsOn, setHapticsOn] = useState(true);
  const [themePref, setThemePrefState] = useState<ThemePref>("system");

  useEffect(() => {
    if (!open) return;
    hasPushSubscription().then(setPushOn);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a saved setting when the sheet opens
    setHapticsOn(hapticsEnabled());
    setThemePrefState(getThemePref());
  }, [open]);

  const needsInstall = isIOS() && !isStandalone();

  return (
    <Sheet open={open} onClose={onClose} title={me?.name}>
      <div className="space-y-2">
        <div>
          {needsInstall ? (
            <p className="rounded-2xl bg-lemon/25 px-4 py-3.5 text-sm">
              For notifications: <b>Share → Add to Home Screen</b>
            </p>
          ) : !pushSupported() ? (
            <p className="text-sm text-muted">Notifications not supported</p>
          ) : pushOn ? (
            <p className="rounded-2xl bg-leaf/10 px-4 py-3.5 text-sm font-medium text-leaf">Notifications on ✓</p>
          ) : (
            <button
              className="w-full rounded-2xl bg-lemon px-4 py-3.5 font-semibold text-on-lemon"
              onClick={async () => {
                try {
                  await enablePush(me!.id);
                  setPushOn(true);
                  toast("Notifications on 🔔");
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            >
              Turn on notifications
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-ink/5 p-1 text-sm font-medium" role="radiogroup" aria-label="Appearance">
          {(
            [
              ["system", "Auto"],
              ["light", "Light"],
              ["dark", "Dark"],
            ] as const
          ).map(([pref, label]) => (
            <button
              key={pref}
              role="radio"
              aria-checked={themePref === pref}
              onClick={() => {
                haptic("tick");
                setThemePref(pref);
                setThemePrefState(pref);
              }}
              className={`rounded-xl py-2.5 transition-colors ${themePref === pref ? "bg-paper text-ink" : "text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex w-full items-center justify-between rounded-2xl bg-ink/5 px-4 py-3.5 font-medium">
          Haptics
          <input
            type="checkbox"
            // iPhone shows a native switch (and plays its own haptic when flipped)
            {...{ switch: "" }}
            checked={hapticsOn}
            onChange={(e) => {
              setHapticsEnabled(e.target.checked);
              setHapticsOn(e.target.checked);
              if (e.target.checked) haptic("tap");
            }}
            className="size-5 accent-[#E0AD00]"
          />
        </label>
        <button
          className="w-full rounded-2xl bg-ink/5 px-4 py-3.5 text-left font-medium"
          onClick={() => supabase.auth.signOut()}
        >
          Sign out
        </button>
      </div>
    </Sheet>
  );
}
