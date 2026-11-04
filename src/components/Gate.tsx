"use client";

import { supabase } from "@/lib/supabase";
import { LemonMark } from "@/components/LemonMark";

// Android already shows its own splash while the app starts, so this one stays a plain
// background and only shows the lemon if loading takes a while (no second splash).
export function Splash() {
  return (
    <main className="grid min-h-dvh place-items-center">
      <LemonMark className="splash-mark size-24" />
    </main>
  );
}

export function NotMember() {
  return (
    <main className="grid min-h-dvh place-items-center px-8 text-center">
      <div>
        <p className="text-4xl">🍋</p>
        <p className="mt-3 font-semibold">This account isn’t one of Lemon’s two readers.</p>
        <button className="mt-4 underline" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    </main>
  );
}
