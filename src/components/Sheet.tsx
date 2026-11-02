"use client";

import { useEffect, type ReactNode } from "react";

/** A floating bottom sheet, the phone-friendly kind of dialog. */
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
    <div className="fixed inset-0 z-50 flex items-end justify-center px-2 pb-[calc(env(safe-area-inset-bottom)+8px)]">
      <div
        className={`fade-in absolute inset-0 backdrop-blur-[2px] ${dark ? "bg-black/45" : "bg-cream/70"}`}
        onClick={onClose}
      />
      <div
        role="dialog"
        className={`sheet-in relative max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-[28px] px-5 pt-3 pb-4 backdrop-blur-xl backdrop-saturate-150 ${
          dark
            ? "border border-white/10 bg-[#26231c]/90 text-[#eee6d3] shadow-[0_10px_40px_rgb(0_0_0/0.5),inset_0_1px_0_rgb(255_255_255/0.07)]"
            : "border border-white/80 bg-paper/90 text-ink shadow-[0_10px_40px_rgb(0_0_0/0.14),inset_0_1px_0_rgb(255_255_255/0.9)]"
        }`}
      >
        <div className={`mx-auto mb-3 h-1.5 w-10 rounded-full ${dark ? "bg-white/20" : "bg-ink/15"}`} />
        {title && <h3 className="mb-4 font-serif text-lg font-semibold leading-snug">{title}</h3>}
        {children}
      </div>
    </div>
  );
}
