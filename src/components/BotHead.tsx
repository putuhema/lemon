"use client";

/**
 * Our little companions, drawn with Open Bot Avatar (https://github.com/dominikscholz/open-bot-avatar).
 * Everyone is a lemon with a leaf, in their own color, with ink eyes.
 */

import { useEffect, useRef, useState } from "react";
import { BASE_PITCH, BASE_YAW, renderAvatarSvg, type AvatarDefinition } from "open-bot-avatar";
import { mountAvatar, prefersReducedMotion, type AvatarOptions, type MountedAvatar } from "open-bot-avatar/dom";

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

/**
 * Facing you. Without a gaze the library rests turned left and tilted up,
 * which on a phone (no mouse to follow) reads as staring at the top left.
 */
const FRONT = { x: 0, y: 0.1 };
/**
 * Still and reduced-motion bots only move their eyes toward a gaze, so the body
 * keeps that resting turn; this view turns it back to face you (BASE_YAW, BASE_PITCH / 2).
 */
const FACE_FRONT = { yaw: -BASE_YAW, pitch: -BASE_PITCH / 2 };

/** Our moods, in the library's three: idle, thinking and happy. `lookAt: null` means free to look around. */
function look(mood: BotMood): Pick<AvatarOptions, "mood" | "lookAt"> {
  switch (mood) {
    case "happy":
    case "love":
      return { mood: "happy", lookAt: null };
    case "reading":
      // eyes down on the page ("thinking" glances up and away)
      return { mood: "idle", lookAt: { x: -0.5, y: 0.6 } };
    case "waiting":
      return { mood: "thinking", lookAt: null };
    case "sleepy":
      // thinking squints and tilts the head, which reads as drowsy when looking down
      return { mood: "thinking", lookAt: { x: 0, y: 1 } };
    default:
      return { mood: "idle", lookAt: null };
  }
}

/** A mouse or trackpad to follow. Touch screens only have a pointer while a finger is down. */
function canHover() {
  return typeof window !== "undefined" && matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/** Below this size a bot is a still picture: lists can hold many, and each live one is a small 3D scene. */
const LIVE_FROM = 40;
/** Moods that are something the bot is doing, so they move at any size. */
const BUSY: BotMood[] = ["reading", "sleepy", "waiting"];

type Gaze = { x: number; y: number } | null;
/** One beat of a mood's little routine: where to look, and for how long (ms). `page` turns the book's page. */
type Beat = { lookAt: Gaze; ms: number; page?: boolean };

const jitter = (ms: number) => ms * (0.8 + Math.random() * 0.4);

/** What a busy bot does over time. The library eases the eyes between beats, so they jump like real eyes. */
function* routine(mood: BotMood, rest: Gaze): Generator<Beat> {
  for (;;) {
    switch (mood) {
      case "reading":
        // four lines, a few jumps each, back to the start of the next line, then turn the page
        for (let line = 0; line < 4; line++) {
          const y = 0.5 + line * 0.12;
          for (let i = 0; i < 4; i++) yield { lookAt: { x: -0.5 + i * 0.33, y }, ms: jitter(i === 0 ? 380 : 300) };
        }
        yield { lookAt: { x: 0.35, y: 0.15 }, ms: 900, page: true };
        yield { lookAt: { x: -0.5, y: 0.5 }, ms: 400 };
        break;
      case "sleepy":
        // drifting off, a little start, and drifting off again
        yield { lookAt: { x: 0, y: 1 }, ms: jitter(3600) };
        yield { lookAt: { x: 0, y: 0.1 }, ms: 520 };
        yield { lookAt: { x: 0, y: 0.6 }, ms: 900 };
        break;
      case "waiting":
        // pondering, with a look to each side for whoever's coming
        yield { lookAt: rest, ms: jitter(2600) };
        yield { lookAt: { x: -0.85, y: 0 }, ms: 1000 };
        yield { lookAt: rest, ms: jitter(2200) };
        yield { lookAt: { x: 0.85, y: 0 }, ms: 1000 };
        break;
      default:
        return;
    }
  }
}

const PINK = "#FF6F91";

/** A little open book held in front, in fixed paper colors like the bot itself. `turn` replays the page flip. */
function Book({ size, turn }: { size: number; turn: number }) {
  const page = "M20 5.5C14 3 8 3 3.5 4.5V19C8 17.5 14 17.5 20 20Z";
  const RIGHT_PAGE = "M20 5.5C26 3 32 3 36.5 4.5V19C32 17.5 26 17.5 20 20Z";
  return (
    <svg
      viewBox="0 0 40 23"
      width={size * 0.6}
      className="absolute left-1/2 -translate-x-1/2"
      style={{ top: "70%" }}
      aria-hidden
    >
      <path d="M1.5 6C8 4.5 14 4.5 20 8 26 4.5 32 4.5 38.5 6V22C32 20.5 26 20.5 20 23 14 20.5 8 20.5 1.5 22Z" fill="#E0AD00" />
      <path d={page} fill="#FFFDF5" />
      <path d={RIGHT_PAGE} fill="#FFFDF5" />
      <path d="M6 8.5H17M6 11.5H17M6 14.5H14M23 8.5H34M23 11.5H34M23 14.5H31" stroke={INK} strokeOpacity=".28" strokeWidth="1.1" strokeLinecap="round" />
      {turn > 0 && <path key={turn} className="bot-page" d={RIGHT_PAGE} fill="#F6EFD9" />}
    </svg>
  );
}

function Heart({ size, delay }: { size: number; delay: number }) {
  return (
    <svg viewBox="0 0 10 9" width={size} className="bot-heart absolute" style={{ animationDelay: `${delay}s` }} aria-hidden>
      <path d="M5 8.6C1.4 6.2 0 4.4 0 2.7 0 1.2 1.2 0 2.6 0 3.6 0 4.5.6 5 1.5 5.5.6 6.4 0 7.4 0 8.8 0 10 1.2 10 2.7 10 4.4 8.6 6.2 5 8.6Z" fill={PINK} />
    </svg>
  );
}

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
  const live = size >= LIVE_FROM || BUSY.includes(mood);
  const [turn, setTurn] = useState(0);
  // Only read in effects (the browser), never while rendering on the server.
  const optionsFor = (): AvatarOptions => {
    const { mood: motion, lookAt } = look(mood);
    // big bots that aren't looking at anything follow the mouse; everyone else faces you
    const follow = live && !lookAt && canHover();
    return {
      definition: LEMON,
      color,
      eyeColor: INK,
      mood: motion,
      lookAt: lookAt ?? (follow ? null : FRONT),
      followPointer: follow,
      view: !live || prefersReducedMotion() ? FACE_FRONT : { yaw: 0, pitch: 0 },
      still: !live,
      label: label ?? "",
    };
  };

  const host = useRef<HTMLDivElement>(null);
  const avatar = useRef<MountedAvatar | null>(null);
  const latest = useRef(optionsFor);
  // Drawn on the server too, so the bot is there before the page wakes up.
  const [first] = useState(() => {
    const { mood: motion, lookAt } = look(mood);
    return renderAvatarSvg(LEMON, { color, eyeColor: INK, motion, gaze: lookAt ?? FRONT, view: FACE_FRONT, reducedMotion: true });
  });

  useEffect(() => {
    latest.current = optionsFor;
  });
  useEffect(() => {
    avatar.current = mountAvatar(host.current!, latest.current());
    return () => {
      avatar.current?.destroy();
      avatar.current = null;
    };
  }, []);
  useEffect(() => {
    avatar.current?.update(optionsFor());
    // optionsFor is rebuilt every render; these are the values it reads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, mood, live, label]);

  // Play the mood's routine, unless the bot is a still picture or motion is turned down.
  useEffect(() => {
    if (!live || prefersReducedMotion()) return;
    const beats = routine(mood, latest.current().lookAt ?? null);
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      const beat = beats.next();
      if (beat.done) return;
      avatar.current?.update({ lookAt: beat.value.lookAt });
      if (beat.value.page) setTurn((t) => t + 1);
      timer = setTimeout(next, beat.value.ms);
    };
    next();
    return () => clearTimeout(timer);
  }, [mood, live]);

  const z = (delay: number, scale: number) => (
    <span className="bot-z absolute" style={{ fontSize: size * scale, animationDelay: `${delay}s` }}>
      z
    </span>
  );

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
      {mood === "reading" && <Book size={size} turn={turn} />}
      {mood === "sleepy" && (
        <span aria-hidden className="pointer-events-none absolute top-[12%] right-[2%] font-serif leading-none font-bold text-ink">
          {z(0, 0.2)}
          {z(1.3, 0.15)}
        </span>
      )}
      {mood === "love" && size >= LIVE_FROM && (
        <span aria-hidden className="pointer-events-none absolute top-[18%] right-[8%]">
          <Heart size={size * 0.16} delay={0} />
          <Heart size={size * 0.12} delay={1.2} />
        </span>
      )}
    </span>
  );
}
