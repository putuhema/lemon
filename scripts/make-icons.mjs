// Renders the Lemon app icons into public/icons. Run: node scripts/make-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const BODY = "M-190 0 C-178 -14 -160 -24 -146 -36 C-104 -118 104 -118 146 -36 C160 -24 178 -14 190 0 C178 14 160 24 146 36 C104 118 -104 118 -146 36 C-160 24 -178 14 -190 0 Z";
const lemon = (s = 1) => `
  <g transform="translate(250 280) scale(${s}) rotate(-30)">
    <path d="${BODY}" fill="#F5CB2E"/>
    <path d="M-146 36 C-104 118 104 118 146 36 C100 80 -100 80 -146 36 Z" fill="#E0AD00" opacity=".45"/>
    <ellipse cx="-50" cy="-58" rx="48" ry="15" fill="#FFF5C2" opacity=".9" transform="rotate(-8 -50 -58)"/>
    <path d="M150 -40 C175 -110 245 -130 285 -120 C265 -70 205 -35 150 -40 Z" fill="#5F8A3C"/>
    <path d="M156 -44 C190 -80 230 -105 275 -118" stroke="#4A6E2D" stroke-width="7" fill="none" stroke-linecap="round"/>
  </g>`;

const svg = ({ bg = true, scale = 1, pad = false } = {}) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  ${bg ? `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF8E1"/><stop offset="1" stop-color="#FFEBA8"/></linearGradient></defs>
  <rect width="512" height="512" ${pad ? "" : 'rx="0"'} fill="url(#g)"/>` : ""}
  ${lemon(scale)}
</svg>`;

const badge = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 512 512">
  <g fill="#fff" transform="translate(240 290) rotate(-30)"><path d="${BODY}"/>
  <path d="M150 -40 C175 -110 245 -130 285 -120 C265 -70 205 -35 150 -40 Z"/></g></svg>`;

mkdirSync("public/icons", { recursive: true });
const out = async (s, size, file) => sharp(Buffer.from(s)).resize(size, size).png().toFile(`public/icons/${file}`);
await out(svg({ scale: 0.9 }), 512, "icon-512.png");
await out(svg({ scale: 0.9 }), 192, "icon-192.png");
await out(svg({ scale: 0.68, pad: true }), 512, "icon-maskable-512.png");
await out(svg({ scale: 0.9 }), 180, "apple-touch-icon.png");
await out(badge, 96, "badge-96.png");
await out(svg({ scale: 0.9 }), 64, "favicon-64.png");
console.log("icons written");
