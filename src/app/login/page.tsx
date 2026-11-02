"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError("That didn’t work. Check your email and password.");
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 pt-safe pb-safe">
      <div className="w-full max-w-sm">
        <img src="/icons/icon-192.png" alt="" className="mx-auto mb-6 size-24 rounded-[28px] shadow-md" />
        <h1 className="text-center font-serif text-4xl font-semibold tracking-tight">Lemon</h1>
        <p className="mt-2 text-center text-muted">Reading together, from far away.</p>

        <form onSubmit={signIn} className="mt-10 space-y-3">
          <input
            type="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3.5 outline-none focus:border-lemon-deep"
            required
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3.5 outline-none focus:border-lemon-deep"
            required
          />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button
            disabled={busy}
            className="w-full rounded-2xl bg-lemon py-3.5 font-semibold text-ink shadow-sm transition active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? "Opening…" : "Open Lemon"}
          </button>
        </form>
      </div>
    </main>
  );
}
