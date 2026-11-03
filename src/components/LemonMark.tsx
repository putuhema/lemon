/** The lemon from the app icon, without the icon's light square, so it sits on any background. */
export function LemonMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <g transform="translate(250 280) rotate(-30)">
        <path
          d="M-190 0 C-178 -14 -160 -24 -146 -36 C-104 -118 104 -118 146 -36 C160 -24 178 -14 190 0 C178 14 160 24 146 36 C104 118 -104 118 -146 36 C-160 24 -178 14 -190 0 Z"
          fill="#F5CB2E"
        />
        <path d="M-146 36 C-104 118 104 118 146 36 C100 80 -100 80 -146 36 Z" fill="#E0AD00" opacity=".45" />
        <ellipse cx="-50" cy="-58" rx="48" ry="15" fill="#FFF5C2" opacity=".9" transform="rotate(-8 -50 -58)" />
        <path d="M150 -40 C175 -110 245 -130 285 -120 C265 -70 205 -35 150 -40 Z" fill="#5F8A3C" />
        <path
          d="M156 -44 C190 -80 230 -105 275 -118"
          stroke="#4A6E2D"
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
