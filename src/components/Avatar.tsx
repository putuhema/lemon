import type { Reader } from "@/lib/types";
import { BotHead, type BotMood } from "./BotHead";

/** A reader's companion bot. */
export function Avatar({ reader, size = 32, mood, bob }: { reader: Reader; size?: number; mood?: BotMood; bob?: boolean }) {
  return <BotHead color={reader.color} size={size} mood={mood} bob={bob} label={reader.name} />;
}
