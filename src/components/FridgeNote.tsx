"use client";

import { useEffect, useState } from "react";
import { useLemon } from "@/lib/lemon";
import { supabase } from "@/lib/supabase";
import { isOffline } from "@/lib/offline";
import { haptic } from "@/lib/haptics";
import { timeAgo } from "@/lib/format";
import { BotHead } from "./BotHead";
import { Sheet } from "./Sheet";

type Note = { body: string; reader_id: string; updated_at: string };

const MAX = 140;
const SEEN_KEY = "lemon-fridge-seen";

/**
 * The note on the fridge: one short line either of you can leave at the top of the shelf.
 * A new note replaces the old one. No thread, no history.
 */
export function FridgeNote() {
  const { me, partner, toast, colorOf, nameOf } = useLemon();
  const [note, setNote] = useState<Note | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [fresh, setFresh] = useState(false);

  useEffect(() => {
    if (!me) return;
    supabase
      .from("fridge")
      .select("body,reader_id,updated_at")
      .maybeSingle()
      .then(({ data }) => setNote((data as Note | null) ?? null));
    const ch = supabase
      .channel("fridge")
      .on("postgres_changes", { event: "*", schema: "public", table: "fridge" }, (e) => {
        if (e.eventType === "DELETE") return setNote(null);
        const n = e.new as Note;
        setNote(n);
        if (n.reader_id !== me.id && partner) {
          toast(`${partner.name} left a note on the fridge 💛`);
          haptic("bump");
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [me, partner, toast]);

  // A note from your partner you haven't seen yet: their bot looks at you with heart eyes
  useEffect(() => {
    if (!note || !me || note.reader_id === me.id) return;
    let seen = "";
    try {
      seen = localStorage.getItem(SEEN_KEY) ?? "";
    } catch {}
    if (seen === note.updated_at) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to a new note arriving
    setFresh(true);
    try {
      localStorage.setItem(SEEN_KEY, note.updated_at);
    } catch {}
  }, [note, me]);

  if (!me || note === undefined) return null;

  function open() {
    haptic("tap");
    setDraft(note && note.reader_id === me!.id ? note.body : "");
    setEditing(true);
  }

  async function save() {
    const body = draft.trim().slice(0, MAX);
    if (!body || !me) return;
    setEditing(false);
    haptic("success");
    const row = { id: true, body, reader_id: me.id, updated_at: new Date().toISOString() };
    const previous = note;
    setNote(row);
    const { error } = await supabase.from("fridge").upsert(row);
    if (error) {
      setNote(previous);
      toast(isOffline() ? "You’re offline. Try again when connected." : "Couldn’t put it up");
    }
  }

  async function takeDown() {
    setEditing(false);
    haptic("tick");
    const previous = note;
    setNote(null);
    const { error } = await supabase.from("fridge").delete().eq("id", true);
    if (error) {
      setNote(previous);
      toast(isOffline() ? "You’re offline" : "Couldn’t take it down");
    }
  }

  return (
    <>
      {note ? (
        <button
          onClick={open}
          aria-label={`Note on the fridge from ${nameOf(note.reader_id)}: ${note.body}. Tap to write a new one.`}
          className="relative block w-full -rotate-[0.8deg] rounded-2xl bg-lemon/25 px-4 pt-5 pb-3 text-left ring-1 ring-lemon-deep/15 transition-transform active:scale-[0.98] dark:bg-lemon/12"
        >
          {/* the magnet */}
          <span className="absolute -top-3 left-1/2 -translate-x-1/2">
            <BotHead
              color={colorOf(note.reader_id)}
              size={28}
              mood={fresh ? "love" : note.reader_id === me.id ? "idle" : "happy"}
              bob={fresh}
              label={nameOf(note.reader_id)}
            />
          </span>
          <p className="text-center font-serif text-[17px] leading-snug text-balance italic">{note.body}</p>
          <p className="mt-1.5 text-center text-[11px] text-muted">
            {note.reader_id === me.id ? "You" : nameOf(note.reader_id)} · {timeAgo(note.updated_at)}
          </p>
        </button>
      ) : (
        <button
          onClick={open}
          className="block w-full rounded-2xl border-2 border-dashed border-ink/10 px-4 py-3 text-center text-sm text-muted active:scale-[0.98]"
        >
          Leave a note on the fridge
        </button>
      )}

      <Sheet open={editing} onClose={() => setEditing(false)} title="Note on the fridge">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <textarea
            autoFocus
            value={draft}
            maxLength={MAX}
            rows={2}
            onChange={(e) => setDraft(e.target.value.replace(/\n/g, " "))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
            placeholder={partner ? `Something for ${partner.name}…` : "Something for them…"}
            className="w-full resize-none rounded-2xl border border-ink/10 bg-white/60 p-3 font-serif text-[17px] italic outline-none focus:border-lemon-deep dark:bg-black/20"
          />
          <p className="mt-1 text-right text-[11px] text-muted tabular-nums">
            {draft.length}/{MAX}
          </p>
          <button
            disabled={!draft.trim()}
            className="mt-2 w-full rounded-2xl bg-lemon py-3.5 font-semibold text-on-lemon disabled:opacity-50"
          >
            {note ? "Replace the note" : "Put it up"}
          </button>
          {note && (
            <button
              type="button"
              onClick={takeDown}
              className="mt-2 w-full rounded-2xl bg-ink/5 py-3.5 font-medium"
            >
              Take it down
            </button>
          )}
        </form>
      </Sheet>
    </>
  );
}
