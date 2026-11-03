"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { BookHeart, BookOpen, Bookmark, Bot, Check, CloudCheck, CloudOff, EyeOff, Heart, Moon, Quote, Share2, Type, Upload, Vibrate } from 'lucide-react'
// Imported part by part, so the page only bundles the kit pieces it uses
import { Stage } from '@/stageshow/kit/stage'
import { Phone } from '@/stageshow/kit/phone'
import { Avatar } from '@/stageshow/kit/parts/Avatar'
import { Count } from '@/stageshow/kit/motion/Count'
import { States } from '@/stageshow/kit/motion/States'
import { useReducedMotion } from '@/stageshow/kit/reduced-motion'
import type { Act } from '@/stageshow/kit/act'
import './grid.css'

// Lemon's features section: a staggered pair on warm paper, after the
// staggered-bento gold. Lemon is a private ebook reader for two people
// reading the same book from far away.
//
//   Tile      Column  Size   Kind        The one thing                         Moves
//   Margins   left    tall   Hero UI     one phone, An's highlight and note     highlight sweeps, note opens
//   Two       right   short  Statement   "Just the two of you."                 the heart beats
//   Live      right   short  Component   An reading now, Follow                 Follow, then her pages turn
//   Ahead     left    short  Stat        "42 pages" ahead                       counts up
//   Nudge     left    short  Component   three nudges, one sent                 a row is tapped, Sent
//   Themes    right   short  Object      paper, sepia, night pages              the pages rise into the crop
//   Offline   left    short  Statement   "Works offline."                       the cloud reconnects
//   Tree      right   tall   Picture     the streak's lemon tree                leaves and lemons grow
//   Little    both    wide   Collection  the smaller features as chips          chips pop in, one by one
//
// Three of nine tiles are UI and one phone is the only device. Across and
// down no kind sits next to itself. Each picture is its own Stage at 1:1,
// pinned to its tile's bottom; each plays one beat, once, in reading order.

const STEP = 110
const LEAD = 450
const AN = '#E8806A'

function Tile({ area, title, children, picture, ground }: { area: string; title: ReactNode; children?: ReactNode; picture?: ReactNode; ground?: boolean }) {
  return (
    <section className={`lm-tile lm-tile--${area}`} data-ground={ground || undefined} data-crop>
      {picture}
      {title ? (
        <p className="lm-copy">
          {title} {children}
        </p>
      ) : (
        children
      )}
    </section>
  )
}

function useInView<T extends Element>(delay: number) {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let t = 0
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      t = window.setTimeout(() => setSeen(true), delay)
    }, { threshold: 0.4 })
    io.observe(el)
    return () => {
      io.disconnect()
      clearTimeout(t)
    }
  }, [delay])
  return [ref, seen] as const
}

function usePictureWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 400, gutter: 30 })
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () => setSize({ width: node.clientWidth, gutter: parseFloat(getComputedStyle(node).getPropertyValue('--pad')) })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return [ref, size] as const
}

/* ---------------- Margins (hero UI: the one phone) ---------------- */

type Margin = { hl: boolean; note: boolean }

async function margins(a: Act<Margin>) {
  await a.wait(LEAD)
  await a.set({ hl: true })
  await a.wait(1100)
  await a.set({ note: true })
}

function Margins() {
  const [ref, { width, gutter }] = usePictureWidth()
  const phone = Math.min(340, width - gutter * 2)
  return (
    <Tile
      area="margins"
      title={<b>Read in the same margins.</b>}
      picture={
        <div ref={ref} className="lm-picture">
          <Stage<Margin> width={width} height={460} initial={{ hl: false, note: false }} poster={{ hl: true, note: true }} play="once" script={margins} className="lm-stage">
            {(s) => (
              <Phone width={phone} className="lm-phone" style={{ left: (width - phone) / 2 }}>
                <div className="lm-page" data-hl={s.hl || undefined} data-note={s.note || undefined}>
                  <span className="lm-page__chapter">Chapter 1</span>
                  <p className="lm-page__p">
                    <span className="lm-hl">It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.</span>
                  </p>
                  <div className="lm-note" aria-hidden={!s.note}>
                    <Avatar name="An" size={32} style={{ background: AN }} />
                    <span className="lm-note__text">
                      <b>An</b> This line, every time 💛
                    </span>
                  </div>
                  <p className="lm-page__p lm-page__p--indent">
                    However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families
                  </p>
                </div>
              </Phone>
            )}
          </Stage>
        </div>
      }
    >
      Highlights, notes and reactions, hidden until you reach them.
    </Tile>
  )
}

/* ---------------- Two (statement) ---------------- */

function Two() {
  const [ref, seen] = useInView<HTMLDivElement>(LEAD + 1 * STEP)
  return (
    <Tile area="two" title={null}>
      <div ref={ref} className="lm-statement" data-on={seen || undefined}>
        <Heart size={30} className="lm-statement__icon lm-statement__icon--heart" fill="currentColor" strokeWidth={0} />
        <p className="lm-statement__text">
          <b>Just the two of you.</b> Two accounts, one shelf.
        </p>
      </div>
    </Tile>
  )
}

/* ---------------- Live (component) ---------------- */

type Live = { press: boolean; on: boolean; page: number }

// Follow, then her page turns carry yours along: 112, 113, 114
const live = (i: number) => async (a: Act<Live>) => {
  await a.wait(LEAD + i * STEP + 500)
  await a.set({ press: true })
  await a.wait(160)
  await a.set({ press: false, on: true })
  await a.wait(1100)
  await a.set({ page: 113 })
  await a.wait(1100)
  await a.set({ page: 114 })
}

function LiveTile() {
  const [ref, { width }] = usePictureWidth()
  return (
    <Tile
      area="live"
      title={<b>Turn pages together.</b>}
      picture={
        <div ref={ref} className="lm-picture">
          <Stage<Live> width={width} height={170} initial={{ press: false, on: false, page: 112 }} poster={{ press: false, on: true, page: 114 }} play="once" script={live(2)} className="lm-stage">
            {(s) => (
              <div className="lm-live">
                <span className="lm-live__who">
                  <Avatar name="An" size={width < 440 ? 40 : 52} style={{ background: AN }} />
                  <span className="lm-live__dot" />
                </span>
                <span className="lm-live__text">
                  <span className="lm-live__name">An is reading</span>
                  <span className="lm-live__page">Page <Count value={s.page} duration={500} /></span>
                </span>
                <span className="lm-live__button" data-on={s.on || undefined} data-pressed={s.press || undefined}>
                  <States
                    value={s.on ? 'on' : 'off'}
                    states={{
                      off: <span className="lm-live__label">Follow</span>,
                      on: (
                        <span className="lm-live__label">
                          <Check size={16} strokeWidth={2.5} /> Following
                        </span>
                      ),
                    }}
                  />
                </span>
              </div>
            )}
          </Stage>
        </div>
      }
    >
      Follow her page turns while you’re on a call.
    </Tile>
  )
}

/* ---------------- Ahead (stat) ---------------- */

function Ahead() {
  const reduced = useReducedMotion()
  const [ref, seen] = useInView<HTMLDivElement>(LEAD + 3 * STEP)
  return (
    <Tile area="ahead" title={null}>
      <div ref={ref} className="lm-stat">
        <span className="lm-stat__lead">An is</span>
        <span className="lm-stat__number">
          <span className="lm-stat__value">
            <span className="lm-stat__sizer" aria-hidden>42</span>
            <Count value={seen || reduced ? 42 : 0} duration={1300} />
          </span>
          <span className="lm-stat__unit">pages ahead</span>
        </span>
        <span className="lm-stat__label">See where your partner is, and jump to her page.</span>
      </div>
    </Tile>
  )
}

/* ---------------- Nudge (component) ---------------- */

type Nudge = { press: boolean; sent: boolean }

const nudge = (i: number) => async (a: Act<Nudge>) => {
  await a.wait(LEAD + i * STEP + 600)
  await a.set({ press: true })
  await a.wait(180)
  await a.set({ press: false, sent: true })
}

// The focal nudge is second, so the fourth, filler row is the one the crop cuts
const NUDGES = [
  { emoji: '🍋', label: 'Read with me?' },
  { emoji: '💛', label: 'Thinking of you' },
  { emoji: '🌙', label: 'Goodnight read?' },
  { emoji: '🌙', label: 'Goodnight' },
]

function NudgeTile() {
  const [ref, { width }] = usePictureWidth()
  return (
    <Tile
      area="nudge"
      title={<b>Nudge them.</b>}
      picture={
        <div ref={ref} className="lm-picture">
          <Stage<Nudge> width={width} height={196} initial={{ press: false, sent: false }} poster={{ press: false, sent: true }} play="once" script={nudge(4)} className="lm-stage">
            {(s) => (
              <div className="lm-nudges">
                {NUDGES.map((n, i) => {
                  const focal = i === 1
                  return (
                    <div key={n.label} className="lm-nudge" data-pressed={(focal && s.press) || undefined} data-sent={(focal && s.sent) || undefined}>
                      <span className="lm-nudge__emoji">{n.emoji}</span>
                      <span className="lm-nudge__label">{n.label}</span>
                      {focal && (
                        <span className="lm-nudge__sent" aria-hidden={!s.sent}>
                          <Check size={14} strokeWidth={2.75} /> Sent
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Stage>
        </div>
      }
    >
      It lands on their phone as a notification.
    </Tile>
  )
}

/* ---------------- Themes (object) ---------------- */

type Beat = { on: boolean }
const beat = (i: number) => async (a: Act<Beat>) => {
  await a.wait(LEAD + i * STEP)
  await a.set({ on: true })
}

function Themes() {
  const [ref, { width }] = usePictureWidth()
  return (
    <Tile
      area="themes"
      title={<b>Paper, sepia or night.</b>}
      picture={
        <div ref={ref} className="lm-picture">
          <Stage<Beat> width={width} height={190} initial={{ on: false }} poster={{ on: true }} play="once" script={beat(5)} className="lm-stage">
            {(s) => (
              <div className="lm-pages" data-on={s.on || undefined}>
                <span className="lm-sheet lm-sheet--paper" aria-hidden>
                  <span className="lm-sheet__lines"><i style={{ width: '80%' }} /><i style={{ width: '64%' }} /><i style={{ width: '72%' }} /></span>
                </span>
                <span className="lm-sheet lm-sheet--sepia" aria-hidden>
                  <span className="lm-sheet__lines"><i style={{ width: '74%' }} /><i style={{ width: '82%' }} /><i style={{ width: '58%' }} /></span>
                </span>
                <span className="lm-sheet lm-sheet--night">
                  <span className="lm-sheet__aa">Aa</span>
                  <span className="lm-sheet__lines"><i style={{ width: '78%' }} /><i style={{ width: '62%' }} /><i style={{ width: '70%' }} /></span>
                </span>
              </div>
            )}
          </Stage>
        </div>
      }
    >
      Your place is saved, whatever the light.
    </Tile>
  )
}

/* ---------------- Offline (statement) ---------------- */

function Offline() {
  const [ref, seen] = useInView<HTMLDivElement>(LEAD + 6 * STEP + 400)
  return (
    <Tile area="offline" title={null}>
      <div ref={ref} className="lm-statement" data-on={seen || undefined}>
        {/* Offline, then back online: the cloud reconnects in place */}
        <span className="lm-cloud">
          <CloudOff size={30} className="lm-statement__icon lm-cloud__off" strokeWidth={2.25} />
          <CloudCheck size={30} className="lm-statement__icon lm-cloud__on" strokeWidth={2.25} />
        </span>
        <p className="lm-statement__text">
          <b>Works offline.</b> Your place syncs when you land.
        </p>
      </div>
    </Tile>
  )
}

/* ---------------- Tree (picture: the streak) ---------------- */

// Lemon's own streak tree (src/components/LemonTree.tsx) at day 30: every
// leaf cluster and lemon, drawn large. It grows in as the tile arrives.
const CLUSTERS: [number, number, number][] = [
  [0, 0, 1], [-0.8, 0.35, 0.8], [0.8, 0.35, 0.8], [-0.5, -0.55, 0.75], [0.5, -0.55, 0.75], [-1.15, -0.05, 0.6], [1.15, -0.05, 0.6],
]
const LEMONS: [number, number][] = [
  [-0.4, 0.45], [0.45, 0.2], [0, -0.3], [-0.95, 0.15], [0.9, 0.5], [-0.15, 0.8], [0.6, -0.6], [-0.65, -0.5], [0.3, 0.65], [1.2, 0.05],
]

function Tree() {
  const [ref, { width }] = usePictureWidth()
  const ground = 128
  const trunk = 70
  const top = ground - trunk
  const R = 28
  const tree = Math.min(500, width + 40)
  return (
    <Tile
      area="tree"
      ground
      title={<b>Grow a lemon tree.</b>}
      picture={
        <div ref={ref} className="lm-picture">
          <Stage<Beat> width={width} height={440} initial={{ on: false }} poster={{ on: true }} play="once" script={beat(7)} className="lm-stage">
            {(s) => (
              <svg className="lm-tree" data-on={s.on || undefined} viewBox="0 0 160 160" width={tree} height={tree} style={{ left: (width - tree) / 2 }} aria-hidden>
                <circle cx="80" cy="76" r="66" fill="#fff" opacity="0.3" />
                <path d={`M80 ${ground} C80 ${ground - trunk * 0.5} 78 ${top + trunk * 0.3} 80 ${top}`} stroke="#8B5E3C" strokeWidth="8" strokeLinecap="round" fill="none" />
                {CLUSTERS.map(([dx, dy, sc], i) => (
                  <g key={i} transform={`translate(${80 + dx * R} ${top + dy * R})`}>
                    <circle className="lm-tree__grow" r={R * sc} fill={i % 2 ? '#5F8A3C' : '#6FA04B'} style={{ transitionDelay: `${i * 60}ms` }} />
                  </g>
                ))}
                {LEMONS.map(([dx, dy], i) => (
                  <g key={i} transform={`translate(${80 + dx * R} ${top + dy * R}) rotate(-25)`}>
                    <ellipse className="lm-tree__grow" rx="4.6" ry="3.4" fill="#F5CB2E" stroke="#E0AD00" strokeWidth="1" style={{ transitionDelay: `${500 + i * 70}ms` }} />
                  </g>
                ))}
                <path d="M58 126 H102 L97 150 H63 Z" fill="#D98B5F" />
                <rect x="55" y="122" width="50" height="8" rx="3" fill="#C9774A" />
              </svg>
            )}
          </Stage>
        </div>
      }
    >
      Your shared streak: it grows every day you both read.
    </Tile>
  )
}

/* ---------------- Little things (collection) ---------------- */

const LITTLE: [ReactNode, string][][] = [
  [
    [<Bookmark key="i" />, 'Bookmarks'],
    [<Quote key="i" />, 'Quote cards'],
    [<BookHeart key="i" />, '“Our book” keepsake'],
    [<Bot key="i" />, 'Zest and Bloom'],
    [<Vibrate key="i" />, 'Haptics'],
    [<Type key="i" />, 'Font and size'],
  ],
  [
    [<Upload key="i" />, 'Upload once, on both phones'],
    [<Moon key="i" />, 'Dark mode'],
    [<Share2 key="i" />, 'Share to Lemon'],
    [<BookOpen key="i" />, 'Continue reading'],
    [<EyeOff key="i" />, 'No spoilers'],
  ],
]

function Little() {
  const [ref, seen] = useInView<HTMLElement>(LEAD)
  const reduced = useReducedMotion()
  return (
    <section ref={ref} className="lm-tile lm-tile--little" data-on={seen || reduced || undefined} data-crop>
      <p className="lm-copy">
        <b>And the little things.</b> Everything a book for two needs.
      </p>
      <div className="lm-chips" aria-label="More features">
        {LITTLE.map((row, r) => (
          <div key={r} className="lm-chips__row" data-row={r}>
            {row.map(([icon, label], i) => (
              <span key={label} className="lm-chip" style={{ transitionDelay: `${(r * 3 + i) * 70}ms` }}>
                {icon}
                {label}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

export function FeatureGrid() {
  return (
    <div className="lemon-features">
      <div className="lm-grid">
        <div className="lm-col">
          <Margins />
          <Ahead />
          <NudgeTile />
          <Offline />
        </div>
        <div className="lm-col">
          <Two />
          <LiveTile />
          <Themes />
          <Tree />
        </div>
        <Little />
      </div>
    </div>
  )
}
