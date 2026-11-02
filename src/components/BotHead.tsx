/**
 * Our little companions: a robot head with a screen face.
 * The lemon-yellow one wears a leaf (Zest); any other color wears a lemon blossom (Bloom).
 */

export type BotMood = "idle" | "reading" | "happy" | "waiting" | "love" | "sleepy";

const INK = "#2E2A1F";
const EYE = "#FFF8E1";
const LEMON = "#f5cb2e";

function darken(hex: string, amount = 0.14) {
  const n = parseInt(hex.replace("#", ""), 16);
  const c = (shift: number) => Math.max(0, Math.round(((n >> shift) & 255) * (1 - amount)));
  return `rgb(${c(16)} ${c(8)} ${c(0)})`;
}

function Leaf() {
  return (
    <>
      <path d="M60 26 V14" stroke="#4A6E2D" strokeWidth="3" strokeLinecap="round" />
      <path d="M60 15 C62 4 74 0 82 3 C78 12 68 17 60 15Z" fill="#6FA04B" />
      <path d="M61 14 C67 10 73 6 79 4" stroke="#4A6E2D" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </>
  );
}

function Blossom() {
  return (
    <>
      <path d="M60 28 V16" stroke="#4A6E2D" strokeWidth="3" strokeLinecap="round" />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = i * 72 - 90;
        const x = 60 + 6 * Math.cos((a * Math.PI) / 180);
        const y = 10 + 6 * Math.sin((a * Math.PI) / 180);
        return (
          <ellipse
            key={i}
            cx={x}
            cy={y}
            rx="4.6"
            ry="3.4"
            transform={`rotate(${a} ${x} ${y})`}
            fill="#FFFDF5"
            stroke="#F0D9DF"
            strokeWidth="1"
          />
        );
      })}
      <circle cx="60" cy="10" r="3" fill="#F5CB2E" />
    </>
  );
}

function Face({ mood }: { mood: BotMood }) {
  const line = { stroke: EYE, fill: "none", strokeLinecap: "round" as const };
  switch (mood) {
    case "happy":
      return (
        <>
          <path d="M42 62 Q47 54 52 62" strokeWidth="3.2" {...line} />
          <path d="M68 62 Q73 54 78 62" strokeWidth="3.2" {...line} />
          <path d="M53 69 Q60 77 67 69 Z" fill={EYE} />
        </>
      );
    case "reading":
      return (
        <>
          <path d="M42 62 H52 A5 5 0 0 1 42 62Z" fill={EYE} />
          <path d="M68 62 H78 A5 5 0 0 1 68 62Z" fill={EYE} />
          <path d="M57 73 Q60 75 63 73" strokeWidth="2.2" {...line} />
        </>
      );
    case "sleepy":
      return (
        <>
          <path d="M42 62 Q47 66 52 62 M68 62 Q73 66 78 62" strokeWidth="3" {...line} />
          <circle cx="60" cy="72" r="2.4" fill={EYE} />
        </>
      );
    case "love": {
      const heart = (x: number) => `M${x} 66 C${x - 9} 59 ${x - 6} 52 ${x} 57 C${x + 6} 52 ${x + 9} 59 ${x} 66Z`;
      return (
        <>
          <path d={heart(47)} fill="#FF6F91" />
          <path d={heart(73)} fill="#FF6F91" />
          <path d="M54 71 Q60 76 66 71" strokeWidth="2.6" {...line} />
        </>
      );
    }
    case "waiting":
      return (
        <>
          <ellipse className="bot-blink" cx="51" cy="60" rx="5" ry="7" fill={EYE} />
          <ellipse className="bot-blink" cx="77" cy="60" rx="5" ry="7" fill={EYE} />
          <circle cx="63" cy="72" r="2.6" fill="none" stroke={EYE} strokeWidth="2" />
        </>
      );
    default:
      return (
        <>
          <ellipse className="bot-blink" cx="47" cy="60" rx="5" ry="7" fill={EYE} />
          <ellipse className="bot-blink" cx="73" cy="60" rx="5" ry="7" fill={EYE} />
          <path d="M54 70 Q60 75 66 70" strokeWidth="2.6" {...line} />
        </>
      );
  }
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
  const isZest = color.toLowerCase() === LEMON;
  const dark = darken(color);
  const blush = isZest ? "#F28DAA" : "#FFD9E3";
  return (
    <svg
      viewBox="6 -2 108 98"
      width={size}
      height={(size * 98) / 108}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="shrink-0 overflow-visible"
    >
      <g className={bob ? "bot-bob" : undefined}>
        {isZest ? <Leaf /> : <Blossom />}
        <rect x="11" y="50" width="10" height="20" rx="5" fill={dark} />
        <rect x="99" y="50" width="10" height="20" rx="5" fill={dark} />
        <rect x="18" y="28" width="84" height="66" rx="30" fill={color} />
        <rect x="28" y="41" width="64" height="42" rx="19" fill={INK} />
        <Face mood={mood} />
        {mood !== "sleepy" && (
          <>
            <circle cx="36" cy="73" r="3.6" fill={blush} opacity=".85" />
            <circle cx="84" cy="73" r="3.6" fill={blush} opacity=".85" />
          </>
        )}
      </g>
      {mood === "sleepy" && (
        <>
          <text x="92" y="30" fontFamily="Georgia, serif" fontSize="13" fontWeight="700" fill={INK} opacity=".5">
            z
          </text>
          <text x="101" y="20" fontFamily="Georgia, serif" fontSize="9" fontWeight="700" fill={INK} opacity=".35">
            z
          </text>
        </>
      )}
    </svg>
  );
}
