"use client";

import { motion } from "motion/react";

// Where leaf clusters and lemons sit on the canopy, as multiples of its radius.
const CLUSTERS: [number, number, number][] = [
  [0, 0, 1],
  [-0.8, 0.35, 0.8],
  [0.8, 0.35, 0.8],
  [-0.5, -0.55, 0.75],
  [0.5, -0.55, 0.75],
  [-1.15, -0.05, 0.6],
  [1.15, -0.05, 0.6],
];
const LEMONS: [number, number][] = [
  [-0.4, 0.45],
  [0.45, 0.2],
  [0, -0.3],
  [-0.95, 0.15],
  [0.9, 0.5],
  [-0.15, 0.8],
  [0.6, -0.6],
  [-0.65, -0.5],
  [0.3, 0.65],
  [1.2, 0.05],
];

/** A lemon tree that grows with your streak: taller and fuller each day, with a lemon every two days. */
export function LemonTree({ streak, size = 120 }: { streak: number; size?: number }) {
  // Grows fastest in the first days so a new streak visibly changes, then keeps filling out to day 30.
  const g = Math.sqrt(Math.min(streak, 30) / 30);
  const groundY = 128;
  const trunk = streak === 0 ? 12 : 26 + g * 44;
  const topY = groundY - trunk;
  const R = 14 + g * 14;
  const clusters = streak === 0 ? 0 : streak < 3 ? 1 : streak < 7 ? 3 : streak < 14 ? 5 : 7;
  const lemons = Math.min(Math.floor(streak / 2), LEMONS.length);
  const spring = { type: "spring" as const, stiffness: 260, damping: 18 };

  return (
    <svg viewBox="0 0 160 160" width={size} height={size} aria-hidden>
      {/* soft sun */}
      <circle cx="80" cy="82" r="62" fill="#F5CB2E" opacity="0.13" />

      {/* trunk */}
      <motion.path
        initial={false}
        animate={{ d: `M80 ${groundY} C80 ${groundY - trunk * 0.5} ${78} ${topY + trunk * 0.3} 80 ${topY}` }}
        transition={spring}
        stroke="#8B5E3C"
        strokeWidth={streak === 0 ? 3 : 4 + g * 4}
        strokeLinecap="round"
        fill="none"
      />

      {/* a sprout before the first day */}
      {streak === 0 && (
        <g>
          <path d={`M80 ${topY} C72 ${topY - 8} 64 ${topY - 6} 62 ${topY - 2} C68 ${topY + 2} 75 ${topY + 1} 80 ${topY}Z`} fill="#6FA04B" />
          <path d={`M80 ${topY} C88 ${topY - 10} 96 ${topY - 8} 99 ${topY - 4} C93 ${topY + 1} 86 ${topY + 1} 80 ${topY}Z`} fill="#5F8A3C" />
        </g>
      )}

      {/* leaves (each grows from its own center) */}
      {CLUSTERS.slice(0, clusters).map(([dx, dy, sc], i) => (
        <g key={i} transform={`translate(${80 + dx * R} ${topY + dy * R})`}>
          <motion.circle
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ ...spring, delay: i * 0.04 }}
            r={R * sc}
            fill={i % 2 ? "#5F8A3C" : "#6FA04B"}
          />
        </g>
      ))}

      {/* lemons */}
      {LEMONS.slice(0, lemons).map(([dx, dy], i) => (
        <g key={i} transform={`translate(${80 + dx * R} ${topY + dy * R}) rotate(-25)`}>
          <motion.ellipse
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ ...spring, delay: 0.15 + i * 0.05 }}
            rx={4.6}
            ry={3.4}
            fill="#F5CB2E"
            stroke="#E0AD00"
            strokeWidth="1"
          />
        </g>
      ))}

      {/* pot */}
      <path d="M58 126 H102 L97 150 H63 Z" fill="#D98B5F" />
      <rect x="55" y="122" width="50" height="8" rx="3" fill="#C9774A" />
    </svg>
  );
}
