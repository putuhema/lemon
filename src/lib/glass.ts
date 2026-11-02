/** Frosted glass, shared by everything that floats: header, nav, reader controls, toasts. */
export const glass =
  "border border-white/70 bg-white/60 shadow-[0_10px_30px_rgb(0_0_0/0.12),inset_0_1px_0_rgb(255_255_255/0.8)] backdrop-blur-xl backdrop-saturate-150";

/** The same glass for the Night reading theme. */
export const glassDark =
  "border border-white/10 bg-[#2a261e]/60 shadow-[0_10px_30px_rgb(0_0_0/0.45),inset_0_1px_0_rgb(255_255_255/0.07)] backdrop-blur-xl backdrop-saturate-150";

/** A denser glass for small messages that can land on top of book text. */
export const glassDense =
  "border border-white/80 bg-[#fffdf5]/97 shadow-[0_10px_30px_rgb(0_0_0/0.14),inset_0_1px_0_rgb(255_255_255/0.9)] backdrop-blur-xl backdrop-saturate-150";

/*
 * Inside the reader the book lives in an iframe, and Safari doesn't blur iframe content
 * behind glass. These denser versions stay readable with or without the blur.
 */
export const readerGlass =
  "border border-white/80 bg-[#fffdf5]/90 shadow-[0_10px_30px_rgb(0_0_0/0.12),inset_0_1px_0_rgb(255_255_255/0.9)] backdrop-blur-xl backdrop-saturate-150";
export const readerGlassDark =
  "border border-white/10 bg-[#2a261e]/90 shadow-[0_10px_30px_rgb(0_0_0/0.45),inset_0_1px_0_rgb(255_255_255/0.07)] backdrop-blur-xl backdrop-saturate-150";
