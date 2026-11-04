"use client";

/**
 * Our little companions, drawn with Open Bot Avatar (https://github.com/dominikscholz/open-bot-avatar).
 * Everyone is a lemon with a leaf, in their own color, with ink eyes.
 */

import { useEffect, useRef, useState } from "react";
import { renderAvatarSvg, type AvatarDefinition } from "open-bot-avatar";
import { mountAvatar, type AvatarOptions, type MountedAvatar } from "open-bot-avatar/dom";

export type BotMood = "idle" | "reading" | "happy" | "waiting" | "love" | "sleepy";

/** Eyes stay dark ink in both themes: they sit on the lemon body, not on the page. */
const INK = "#2E2A1F";

/** A lemon lying on its side, with pointed tips and a leaf on top. Checked with validateAvatar. */
const LEMON: AvatarDefinition = {
  version: 1,
  id: "lemon",
  name: "Lemon",
  body: {
    path:
      "M10 60C13 57 16 56 19 54.5C23 41 36 34 50 34C64 34 77 41 81 54.5C84 56 87 57 90 60" +
      "C87 63 84 64 81 65.5C77 79 64 86 50 86C36 86 23 79 19 65.5C16 64 13 63 10 60Z" +
      "M49 35C49 27 54 18 65 15C72 13 78 14 82 16C79 25 71 31 61 33C56 34 52 34.5 49 35Z",
  },
  eyes: { x: 50, y: 58, spacing: 22, scale: 1.25 },
};

/** Our moods, in the library's three: idle, thinking and happy. */
function look(mood: BotMood): Pick<AvatarOptions, "mood" | "lookAt"> {
  switch (mood) {
    case "happy":
    case "love":
      return { mood: "happy", lookAt: null };
    case "reading":
      return { mood: "thinking", lookAt: { x: 0, y: 0.8 } };
    case "waiting":
      return { mood: "thinking", lookAt: null };
    case "sleepy":
      return { mood: "idle", lookAt: { x: 0, y: 1 } };
    default:
      return { mood: "idle", lookAt: null };
  }
}

/** Below this size a bot is a still picture: lists can hold many, and each live one is a small 3D scene. */
const LIVE_FROM = 40;

export function BotHead({
  color,
  mood = "idle",
  size = 32,
  bob = false,
  label,
}: {
  color: string;
  mood?: BotMood;
  size?: number;
  /** gentle floating, for bigger heads */
  bob?: boolean;
  label?: string;
}) {
  const live = size >= LIVE_FROM;
  const options: AvatarOptions = {
    definition: LEMON,
    color,
    eyeColor: INK,
    ...look(mood),
    // big bots that aren't looking at anything follow your finger
    followPointer: live && mood !== "reading" && mood !== "sleepy",
    still: !live,
    label: label ?? "",
  };

  const host = useRef<HTMLDivElement>(null);
  const avatar = useRef<MountedAvatar | null>(null);
  const latest = useRef(options);
  // Drawn on the server too, so the bot is there before the page wakes up.
  const [first] = useState(() =>
    renderAvatarSvg(LEMON, { color, eyeColor: INK, motion: look(mood).mood, reducedMotion: true }),
  );

  useEffect(() => {
    latest.current = options;
  });
  useEffect(() => {
    avatar.current = mountAvatar(host.current!, latest.current);
    return () => {
      avatar.current?.destroy();
      avatar.current = null;
    };
  }, []);
  useEffect(() => {
    avatar.current?.update(options);
    // options is rebuilt every render; these are the values it is made from
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, mood, live, label]);

  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <span className={`block size-full ${bob ? "bot-bob" : ""}`}>
        <span
          ref={host}
          className="block size-full"
          role={label ? "img" : undefined}
          aria-label={label}
          aria-hidden={label ? undefined : true}
          dangerouslySetInnerHTML={{ __html: first }}
        />
      </span>
      {mood === "sleepy" && (
        <span aria-hidden className="pointer-events-none absolute -top-1 -right-1 font-serif font-bold text-ink">
          <span className="absolute right-2 top-2 opacity-50" style={{ fontSize: size * 0.2 }}>
            z
          </span>
          <span className="absolute right-0 top-0 opacity-35" style={{ fontSize: size * 0.14 }}>
            z
          </span>
        </span>
      )}
    </span>
  );
}
