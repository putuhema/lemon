// Makes page turns in the reader smooth.
//
// foliate-js animates a page turn by changing scrollLeft on every frame from JavaScript.
// That runs on the main thread, so it drops frames whenever anything else is busy, and
// Safari caps it at 60fps even on 120Hz screens. This swaps it for a GPU slide: jump the
// scroll position to the new page at once, then slide the page in with a transform
// animation, which the browser runs off the main thread at the screen's full refresh rate.
//
// Runs on `npm install` (postinstall). Safe to run more than once.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const file =
  process.argv[2] ??
  fileURLToPath(import.meta.resolve("foliate-js/paginator.js"));
let src = readFileSync(file, "utf8");
const MARK = "/* lemon: gpu page slide */";
if (src.includes(MARK)) process.exit(0);

function replace(from, to) {
  if (!src.includes(from)) {
    console.error(
      `patch-foliate: foliate-js changed, couldn't find:\n${from}\nPage turns will use the old animation.`,
    );
    process.exit(0);
  }
  src = src.replace(from, to);
}

// 1. A helper that slides the page on the GPU
replace(
  "const lerp = (min, max, x) =>",
  `${MARK}
const slide = (container, el, prop, to, duration) => {
    const from = container[prop]
    container[prop] = to
    // use what the browser actually applied (it may round or clamp)
    const delta = container[prop] - from
    if (!delta || !el?.animate) return Promise.resolve()
    const axis = prop === 'scrollLeft' ? 'X' : 'Y'
    return el.animate([
        { transform: \`translate\${axis}(\${delta}px)\` },
        { transform: 'none' },
    ], { duration, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' })
        .finished.catch(() => {})
}
// Stops a slide halfway and keeps the page where it is, so a finger can take over
const stopSlide = (container, el, prop) => {
    const anims = el?.getAnimations?.() ?? []
    if (!anims.length) return
    const m = new DOMMatrix(getComputedStyle(el).transform)
    const t = prop === 'scrollLeft' ? m.m41 : m.m42
    for (const a of anims) a.cancel()
    container[prop] -= t
}
const lerp = (min, max, x) =>`,
);

// 2. Use it for animated page turns and swipe snaps
replace(
  `if ((reason === 'snap' || smooth) && this.hasAttribute('animated')) return animate(
            this.containerPosition, offset, 300, easeOutQuad,
            x => this.containerPosition = x,
        ).then(() => {`,
  `if ((reason === 'snap' || smooth) && this.hasAttribute('animated')) return slide(
            this.#container, this.#view?.element, this.scrollProp, offset, 300,
        ).then(() => {`,
);

// 3. Touching the page mid-slide grabs it where it is
replace(
  `#onTouchStart(e) {
        const touch = e.changedTouches[0]`,
  `#onTouchStart(e) {
        stopSlide(this.#container, this.#view?.element, this.scrollProp)
        const touch = e.changedTouches[0]`,
);

writeFileSync(file, src);
console.log("patch-foliate: smooth page turns on");
