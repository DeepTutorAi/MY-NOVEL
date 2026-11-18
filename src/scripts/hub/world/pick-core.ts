// Pure choice behind the hub's "pick a novel for me" buttons (spec 2.17).

import { hashName } from "../guest-names-core.mjs";
import type { CardInfo, PickInput, PickResult } from "./types";

/** sessionStorage key holding how many picks were made in this session. */
export const PICK_KEY = "piichan-novels:hub-pick";
/** Minimum time between two picks. */
export const PICK_GAP_MS = 2600;

/** Seed for the day's shuffle: FNV-1a of "<localDay>:<profileId>". */
export function pickSeed(localDay: string, profileId: string): number {
  return hashName(`${localDay}:${profileId}`);
}

/** mulberry32: a small deterministic generator in [0, 1). */
function generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], next: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

const neverStarted = (card: CardInfo) => card.read === null;

/**
 * Open, unfinished cards other than the resumed novel, in the day's order:
 * never-started novels first, then novels in progress, each group shuffled by `seed`.
 */
export function pickCandidates(cards: readonly CardInfo[], resumeSlug: string | null, seed: number): CardInfo[] {
  const eligible = [...cards]
    .filter((card) => card.kind === "open" && !card.finished && card.slug !== resumeSlug)
    .sort((a, b) => a.index - b.index);
  const next = generator(seed);
  const fresh = shuffle(eligible.filter(neverStarted), next);
  const started = shuffle(eligible.filter((card) => !neverStarted(card)), next);
  return [...fresh, ...started];
}

/**
 * Press N of the session returns candidates[N mod length]. With no other candidate,
 * an unfinished resumed novel is offered again as "continue"; otherwise "all-read".
 */
export function pickNovel(input: PickInput): PickResult {
  const candidates = pickCandidates(input.cards, input.resumeSlug, pickSeed(input.localDay, input.profileId));
  if (candidates.length === 0) {
    const resumed = input.cards.find((card) => card.slug === input.resumeSlug && card.kind === "open" && !card.finished);
    return resumed ? { slug: resumed.slug, reason: "continue" } : { slug: null, reason: "all-read" };
  }
  const press = Number.isFinite(input.press) && input.press > 0 ? Math.floor(input.press) : 0;
  const choice = candidates[press % candidates.length];
  return { slug: choice.slug, reason: neverStarted(choice) ? "new" : "continue" };
}
