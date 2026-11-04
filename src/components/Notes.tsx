"use client";

import { useState } from "react";
import { ImageIcon, PenLineIcon, Trash2Icon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isOffline } from "@/lib/offline";
import { timeAgo } from "@/lib/format";
import type { Annotation, Reply } from "@/lib/types";
import { BotHead } from "@/components/BotHead";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Sheet } from "@/components/Sheet";

/** Quick reactions on a highlight, in books and journals. */
export const EMOJI = ["💛", "😂", "😭", "🥹", "🔥", "😮"];

/** What a note thread needs from a highlight (a book's or a paper's; both live in "annotations"). */
type NoteLike = Pick<Annotation, "id" | "reader_id" | "quote" | "note" | "emoji" | "created_at">;

export function NoteComposer({
  open,
  quote,
  onCancel,
  onSave,
}: {
  open: boolean;
  quote: string;
  onCancel: () => void;
  onSave: (note: string, emoji?: string) => void;
}) {
  const [text, setText] = useState("");
  const [emoji, setEmoji] = useState<string | undefined>();
  return (
    <Sheet
      open={open}
      onClose={() => {
        setText("");
        onCancel();
      }}
      title="Note"
    >
      <p className="line-clamp-3 border-l-4 border-lemon pl-3 font-serif text-[15px] italic text-ink/80">
        “{quote}”
      </p>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a note…"
        rows={3}
        className="mt-4 w-full resize-none rounded-2xl border border-ink/10 bg-white/60 p-3 outline-none focus:border-lemon-deep"
      />
      <div className="mt-2 flex gap-1">
        {EMOJI.map((e) => (
          <button
            key={e}
            onClick={() => setEmoji(emoji === e ? undefined : e)}
            className={`grid size-10 place-items-center rounded-full text-xl ${emoji === e ? "bg-lemon/50" : ""}`}
          >
            {e}
          </button>
        ))}
      </div>
      <button
        disabled={!text.trim()}
        onClick={() => {
          onSave(text, emoji);
          setText("");
          setEmoji(undefined);
        }}
        className="mt-4 w-full rounded-2xl bg-lemon py-3.5 font-semibold disabled:opacity-50 text-on-lemon"
      >
        Save note
      </button>
    </Sheet>
  );
}

export function AnnotationThread<T extends NoteLike>({
  list,
  replies,
  meId,
  colorOf,
  nameOf,
  onDeleted,
  onReply,
  onUpdated,
  onError,
  onCard,
}: {
  list: T[];
  replies: Reply[];
  meId: string;
  colorOf: (id: string) => string;
  nameOf: (id: string) => string;
  onDeleted: (id: string) => void;
  onReply: (r: Reply) => void;
  onUpdated: (a: T) => void;
  onError: (message: string) => void;
  onCard: (a: T) => void;
}) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const first = list[0];

  return (
    <div>
      <p
        className="border-l-4 pl-3 font-serif text-[16px] italic leading-relaxed"
        style={{ borderColor: colorOf(first.reader_id) }}
      >
        “{first.quote}”
      </p>
      <button
        onClick={() => onCard(first)}
        className="mt-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
        style={{ background: "rgba(127,127,127,.12)" }}
      >
        <ImageIcon className="size-3.5" /> Quote card
      </button>

      <div className="mt-4 space-y-3">
        {list.map((a) => (
          <div key={a.id} className="flex gap-2.5">
            <BotHead
              color={colorOf(a.reader_id)}
              size={28}
              mood={a.reader_id === meId ? "idle" : "love"}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs opacity-60">
                {nameOf(a.reader_id)} · {timeAgo(a.created_at)} {a.emoji}
              </p>
              {editing === a.id ? (
                <div className="mt-1">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-xl border border-current/20 bg-transparent p-2 outline-none"
                  />
                  <button
                    className="mt-1 rounded-full bg-lemon px-3 py-1 text-sm font-semibold text-on-lemon"
                    onClick={async () => {
                      const { data } = await supabase
                        .from("annotations")
                        .update({ note: editText.trim() || null })
                        .eq("id", a.id)
                        .select()
                        .single();
                      if (data) onUpdated(data as T);
                      setEditing(null);
                    }}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <p className="mt-0.5">
                  {a.note ?? <span className="opacity-50">Highlighted</span>}
                </p>
              )}
              {a.reader_id === meId && editing !== a.id && (
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-medium">
                  <button
                    className="flex items-center gap-1 rounded-full px-3 py-1.5"
                    style={{ background: "rgba(127,127,127,.14)" }}
                    onClick={() => {
                      setEditing(a.id);
                      setEditText(a.note ?? "");
                    }}
                  >
                    <PenLineIcon className="size-3.5" />{" "}
                    {a.note ? "Edit note" : "Add note"}
                  </button>
                  {(a.note || a.emoji) && (
                    <button
                      className="rounded-full px-3 py-1.5"
                      style={{ background: "rgba(127,127,127,.14)" }}
                      onClick={async () => {
                        const { data, error } = await supabase
                          .from("annotations")
                          .update({ note: null, emoji: null })
                          .eq("id", a.id)
                          .select()
                          .single();
                        if (error || !data)
                          return onError(
                            isOffline() ? "You’re offline" : "Couldn’t remove",
                          );
                        onUpdated(data as T);
                      }}
                    >
                      Remove note
                    </button>
                  )}
                  <ConfirmButton
                    className="flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1.5 text-red-700 dark:text-red-300"
                    ariaLabel="Delete highlight"
                    onConfirm={async () => {
                      const { error } = await supabase
                        .from("annotations")
                        .delete()
                        .eq("id", a.id);
                      if (error)
                        return onError(
                          isOffline() ? "You’re offline" : "Couldn’t delete",
                        );
                      onDeleted(a.id);
                    }}
                  >
                    <Trash2Icon className="size-3.5" /> Delete
                  </ConfirmButton>
                </div>
              )}
            </div>
          </div>
        ))}

        {replies.map((r) => (
          <div key={r.id} className="ml-8 flex gap-2.5">
            <BotHead color={colorOf(r.reader_id)} size={22} />
            <div>
              <p className="text-xs opacity-60">
                {nameOf(r.reader_id)} · {timeAgo(r.created_at)}
              </p>
              <p className="mt-0.5">{r.body}</p>
            </div>
          </div>
        ))}
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          const { data } = await supabase
            .from("replies")
            .insert({
              annotation_id: first.id,
              reader_id: meId,
              body: text.trim(),
            })
            .select()
            .single();
          if (!data)
            return onError(
              isOffline()
                ? "You’re offline. Try again when connected."
                : "Couldn’t send",
            );
          onReply(data as Reply);
          setText("");
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Reply…"
          className="min-w-0 flex-1 rounded-full border border-current/15 bg-transparent px-4 py-2.5 outline-none"
        />
        <button className="rounded-full bg-lemon px-4 font-semibold text-on-lemon">
          Send
        </button>
      </form>
    </div>
  );
}
