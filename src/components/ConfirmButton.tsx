"use client";

import { useEffect, useState, type ReactNode } from "react";
import { haptic } from "@/lib/haptics";

/** A button that asks "Tap again" before it acts, so a stray tap can't delete something. */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "Tap again to delete",
  className = "",
  ariaLabel,
}: {
  onConfirm: () => void;
  children: ReactNode;
  confirmLabel?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      aria-label={armed ? confirmLabel : ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        if (armed) {
          haptic("success");
          setArmed(false);
          onConfirm();
        } else {
          haptic("tap");
          setArmed(true);
        }
      }}
      className={`${className} transition-colors ${armed ? "!bg-red-600 !text-white" : ""}`}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
