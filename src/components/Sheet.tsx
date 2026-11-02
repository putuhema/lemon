"use client";

import { useEffect, type ReactNode } from "react";

/** A bottom sheet, the phone-friendly kind of dialog. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  tone = "light",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  tone?: "light" | "dark";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const dark = tone === "dark";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="fade-in absolute inset-0 bg-black/35" onClick={onClose} />
      <div
        role="dialog"
        className={`sheet-in relative max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl px-5 pt-3 pb-safe shadow-2xl ${
          dark ? "bg-[#26231c] text-[#eee6d3]" : "bg-paper text-ink"
        }`}
      >
        <div className={`mx-auto mb-3 h-1.5 w-10 rounded-full ${dark ? "bg-white/20" : "bg-ink/15"}`} />
        {title && <h3 className="mb-4 font-serif text-lg font-semibold leading-snug">{title}</h3>}
        <div className="pb-3">{children}</div>
      </div>
    </div>
  );
}
