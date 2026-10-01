// Pure logic of the once-per-day part/arc cutscene, shared by Sea and
// Tsukinomi. It touches no DOM, storage or clock of its own (callers pass
// `now`), so every rule here runs under node:test. The DOM lifecycle that
// acts on these rules is runner.ts (used by Tsukinomi; Sea keeps its own, see
// the header there). Sea's runner also carries a copy of parseCutsceneParams
// and shouldPlay, because the Sea contract tests pin those lines in its file;
// cutscene-core-parity.test.ts holds the copies to the functions below.
//
// The no-flash covers decide "covered or not" before first paint with an
// inline copy of the cooldown and trigger rules below: SeaBaseLayout.astro
// (pinned by src/scripts/sea/cutscene.test.ts) and TsukinomiCutscene.astro
// (pinned by src/scripts/tsukinomi/cutscene/gate.test.ts). COOLDOWN_RESET_HOUR
// must stay equal to the hour they hard-code. The Tsukinomi copy also accepts
// the numeric-millisecond form of a played stamp; Sea's never wrote one.
//
// State machine, driven by transition(). Final set of states:
//
//   idle      nothing decided yet
//   pending   the trigger says play; waiting for the tab to be visible
//   loading   scene module and assets are loading under the cover
//   playing   the dialog is open and the scene (or the static still) runs
//   finishing a finish was requested (skip, Escape, tap or scene end) and
//             the fade-out runs; Sea needs this state for its 250ms fade
//   finished  terminal: the dialog was shown and is now closed, whether the
//             scene ran to its end, the reader skipped it or the page left
//   skipped   terminal: the cutscene never opened on this visit (cooldown,
//             resume, history traversal, cover already lifted, scene failed
//             to load, or the page was left before it could open)
//
// Sea's own runner names its last state "done"; that is finished when the
// dialog had opened and skipped when it had not.
//
// Legal transitions (event -> next state):
//
//   idle       queue -> pending      abandon, abort -> skipped
//   pending    visible -> loading    abandon, abort -> skipped
//   loading    open -> playing       abandon, abort -> skipped
//   playing    finish -> finishing   close, abort -> finished
//   finishing  close, abort -> finished
//   finished, skipped: terminal, nothing leaves them
//
// Any other pair is illegal and leaves the state unchanged, so a late click
// or a second Escape is harmless.

/** Local hour at which the once-per-day cooldown resets. */
export const COOLDOWN_RESET_HOUR = 6;

/** The current cooldown day: from the latest 06:00 local time to the next one. */
export function cooldownDay(now: Date): { start: number; end: number } {
  const start = new Date(now);
  start.setHours(COOLDOWN_RESET_HOUR, 0, 0, 0);
  if (start.getTime() > now.getTime()) start.setDate(start.getDate() - 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

/** The value written under a played key: an ISO timestamp (Sea's format). */
export function playedStamp(now: Date): string {
  return now.toISOString();
}

// The widest span a Date can represent, in milliseconds since the epoch.
const MAX_TIME_MS = 8.64e15;

/**
 * A stored played value as milliseconds since the epoch, or null when it is
 * unreadable. Accepts an ISO string (Sea, and what runner.ts writes) and a
 * legacy millisecond count written as digits ("1790803177728", the format
 * Tsukinomi's old cutscene used). Never throws.
 */
export function parsePlayedStamp(stored: unknown): number | null {
  if (typeof stored !== "string") return null;
  const text = stored.trim();
  if (text === "") return null;
  const at = /^-?\d+$/.test(text) ? Number(text) : Date.parse(text);
  return Number.isFinite(at) && at >= 0 && at <= MAX_TIME_MS ? at : null;
}

/**
 * Whether a stored played value falls in the current cooldown day. Missing,
 * empty, unreadable, negative and out-of-range values count as not played, as
 * does anything dated before the latest 06:00 or from the next cooldown day
 * onwards (so a far-future value never suppresses a cutscene). Never throws.
 */
export function playedToday(stored: string | null | undefined, now: Date): boolean {
  const at = parsePlayedStamp(stored);
  if (at === null) return false;
  const { start, end } = cooldownDay(now);
  return at >= start && at < end;
}

export interface CutsceneParams {
  resume: boolean;
  replay: boolean;
  force: boolean;
  /** Dev-only scene override (?cutscene=force&scene=sealed-depth). */
  scene: string | null;
}

export function parseCutsceneParams(search: string): CutsceneParams {
  const params = new URLSearchParams(search);
  const mode = params.get("cutscene");
  return {
    resume: params.get("resume") === "1",
    replay: mode === "replay",
    force: mode === "force",
    scene: params.get("scene"),
  };
}

export interface CutsceneTrigger {
  /** This page carries a cutscene (Sea: the article has data-arc-entry). */
  hasEntry: boolean;
  resume: boolean;
  /** Back/forward history traversal (Astro navigationType "traverse", or a back_forward page load). */
  traversal: boolean;
  played: boolean;
  replay: boolean;
  force: boolean;
  dev: boolean;
}

/**
 * Keep in sync with the inline gates in SeaBaseLayout.astro and
 * TsukinomiCutscene.astro, which apply the same rule before first paint to
 * decide whether to cover the page.
 */
export function shouldPlay(trigger: CutsceneTrigger): boolean {
  if (!trigger.hasEntry) return false;
  if (trigger.replay || (trigger.force && trigger.dev)) return true;
  return !trigger.resume && !trigger.traversal && !trigger.played;
}

/** The URL without the cutscene-only parameters. */
export function cleanCutsceneUrl(href: string): string {
  const url = new URL(href);
  const mode = url.searchParams.get("cutscene");
  if (mode === "replay" || mode === "force") {
    url.searchParams.delete("cutscene");
    url.searchParams.delete("scene");
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export type CutsceneState = "idle" | "pending" | "loading" | "playing" | "finishing" | "finished" | "skipped";

export type CutsceneEvent =
  /** The trigger says play. */
  | "queue"
  /** The tab is visible, so loading may begin. */
  | "visible"
  /** The dialog was opened (showModal). */
  | "open"
  /** A finish was requested: skip, Escape, tap or the scene reached its end. */
  | "finish"
  /** The dialog closed. */
  | "close"
  /** Stop before anything was shown. */
  | "abandon"
  /** The page is being left (astro:before-swap) or the runner was destroyed. */
  | "abort";

type TransitionTable = Readonly<Record<CutsceneState, Readonly<Partial<Record<CutsceneEvent, CutsceneState>>>>>;

const TRANSITIONS: TransitionTable = {
  idle: { queue: "pending", abandon: "skipped", abort: "skipped" },
  pending: { visible: "loading", abandon: "skipped", abort: "skipped" },
  loading: { open: "playing", abandon: "skipped", abort: "skipped" },
  playing: { finish: "finishing", close: "finished", abort: "finished" },
  finishing: { close: "finished", abort: "finished" },
  finished: {},
  skipped: {},
};

/** The state after `event`, or `state` itself when the event is illegal there. */
export function transition(state: CutsceneState, event: CutsceneEvent): CutsceneState {
  if (!Object.hasOwn(TRANSITIONS, state)) return state;
  const row = TRANSITIONS[state];
  return Object.hasOwn(row, event) ? (row[event] ?? state) : state;
}

export function canTransition(state: CutsceneState, event: CutsceneEvent): boolean {
  return transition(state, event) !== state;
}

/** finished and skipped: nothing leaves them. */
export function isSettled(state: CutsceneState): state is "finished" | "skipped" {
  return state === "finished" || state === "skipped";
}
