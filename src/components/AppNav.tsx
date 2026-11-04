"use client";

import { useState } from "react";
import { useLemon } from "@/lib/lemon";
import { BotHead } from "./BotHead";
import { FloatingNav, LibraryBigIcon } from "./Floating";
import { LemonMark } from "./LemonMark";
import { SettingsSheet } from "./SettingsSheet";

/** The bottom bar on the main pages: Home, Reading, and your profile (settings). */
export function AppNav({ active }: { active: "home" | "reading" }) {
  const { me } = useLemon();
  const [settingsOpen, setSettingsOpen] = useState(false);
  if (!me) return null;
  return (
    <>
      <FloatingNav
        active={active}
        items={[
          { id: "home", label: "Home", icon: <LemonMark className="size-6" />, href: "/" },
          { id: "reading", label: "Reading", icon: LibraryBigIcon, href: "/reading" },
          {
            id: "me",
            label: me.name,
            icon: <BotHead color={me.color} size={26} label={me.name} />,
            onClick: () => setSettingsOpen(true),
          },
        ]}
      />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
