import type { Metadata } from "next";
import Link from "next/link";
import { FeatureGrid } from "./FeatureGrid";

export const metadata: Metadata = {
  title: "Lemon · Reading together, from far away",
  description: "A private ebook reader for two: shared highlights and notes, live page turns, nudges and a lemon tree that grows as you read.",
};

export default function FeaturesPage() {
  return (
    // Always the light, paper look: this page is the same picture for everyone
    <main className="min-h-dvh bg-[#fffdf5] px-4 pt-[calc(env(safe-area-inset-top)+48px)] pb-[calc(env(safe-area-inset-bottom)+64px)] text-[#2e2a1f] [color-scheme:light] sm:px-8">
      <header className="mx-auto mb-10 max-w-[984px] text-center">
        <img src="/icons/icon-192.png" alt="" className="mx-auto size-16 rounded-2xl" />
        <p className="mt-5 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Reading together, from far away.</p>
        <p className="mx-auto mt-3 max-w-md text-lg text-[#8a8170]">
          Lemon is a private ebook reader for two. Same book, two phones, one shelf.
        </p>
        <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-lemon px-6 font-semibold text-on-lemon">
          Open Lemon
        </Link>
      </header>
      <FeatureGrid />
    </main>
  );
}
