# Rehearsal: Lemon features grid (`/features`)

Gold: `staggered-bento` (Stageshow). Kept its structure: two columns of rounded tiles, tall and short alternating, one Stage per picture pinned to the tile's bottom at 1:1, copy as page type above, one beat per tile played once in reading order. Changed the look and content to Lemon: paper and lemon colors, Fraunces and Inter, Lucide icons (Lemon's own set), Lemon's streak tree art, reader themes and nudge strings. Added a wide "little things" tile for the smaller features.

Tiles: Margins (hero phone: An's highlight sweeps, her note opens), Just the two of you (the heart beats), Turn pages together (Follow, then her pages turn 112 to 114), 42 pages ahead (count up), Nudge them (Thinking of you, Sent), Paper, sepia or night (pages rise), Works offline (the cloud reconnects), Grow a lemon tree (leaves and lemons grow), And the little things (chips pop in one by one).

Beats: each tile plays once as it scrolls in, 110ms apart; the hero takes about 2s (highlight, then note). Reduced motion shows each tile's poster, the finished state.

Captured: 1100 and 390 wide in the Stageshow playground (`film.mjs --gate`: passed at both), and the real page at 1280 and 390 in Lemon's dev server.

Film:
- `jump` on the highlight at about 0.45s: the serif font swapping in while the playground loads it from Google Fonts. On the Lemon page the font comes from next/font.
- `kit override` (30 lines, Lemon page only): false alarms. The kit's CSS is still inside `@layer stageshow` (checked in the browser), but the film tool can't tell kit CSS from page CSS once Next bundles it. The same scene in the playground has none.
- `uneven padding` on the live pill: fixed by centering the text on its ink and keeping the pill under 72px tall.
- Small "Chapter 1" text on phones: raised to 15pt.

Review: a self-review against the gold, not a separate fresh reviewer.

Assumptions: the partner is called "An", the book is Pride and Prejudice (public domain), and the page always uses the light paper look.

Not checked: real devices, dark mode of the host page (the page forces light), reduced motion visually, tablet widths between 600 and 900.
