/** Frosted glass, shared by everything that floats. No shadows: a thin border sets it apart. */
export const glass =
  "border border-ink/10 bg-white/60 backdrop-blur-xl backdrop-saturate-150";

/** The same glass for the Night reading theme. */
export const glassDark =
  "border border-white/10 bg-[#2a261e]/60 backdrop-blur-xl backdrop-saturate-150";

/** A denser glass for small messages that can land on top of book text. */
export const glassDense =
  "border border-ink/10 bg-[#fffdf5]/97 backdrop-blur-xl backdrop-saturate-150";

/*
 * Inside the reader the book lives in an iframe, and Safari doesn't blur iframe content
 * behind glass. These denser versions stay readable with or without the blur.
 */
export const readerGlass =
  "border border-ink/10 bg-[#fffdf5]/90 backdrop-blur-xl backdrop-saturate-150";
export const readerGlassDark =
  "border border-white/10 bg-[#2a261e]/90 backdrop-blur-xl backdrop-saturate-150";
