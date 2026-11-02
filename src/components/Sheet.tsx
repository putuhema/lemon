"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion, useDragControls, type PanInfo } from "motion/react";

/** A floating bottom sheet. Drag the top (handle or title) down to close it. */
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
  const drag = useDragControls();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 90 || info.velocity.y > 500) onClose();
  };

  const dark = tone === "dark";
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-end justify-center px-2 pb-[calc(env(safe-area-inset-bottom)+8px)]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={`absolute inset-0 backdrop-blur-[2px] ${dark ? "bg-black/45" : "bg-cream/70"}`}
              onClick={onClose}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "110%" }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
              drag="y"
              dragListener={false}
              dragControls={drag}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.05, bottom: 0.9 }}
              onDragEnd={onDragEnd}
              className={`relative flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] backdrop-blur-xl backdrop-saturate-150 ${
                dark ? "border border-white/10 bg-[#26231c]/90 text-[#eee6d3]" : "border border-ink/10 bg-paper/90 text-ink"
              }`}
            >
              {/* drag area: the handle and the title */}
              <div
                className="shrink-0 cursor-grab touch-none px-5 pt-3 active:cursor-grabbing"
                onPointerDown={(e) => drag.start(e)}
              >
                <div className={`mx-auto mb-3 h-1.5 w-10 rounded-full ${dark ? "bg-white/20" : "bg-ink/15"}`} />
                {title && <h3 className="mb-4 font-serif text-lg font-semibold leading-snug">{title}</h3>}
              </div>
              <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
