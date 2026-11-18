// Pure limiter behind the scene output channel (spec 2.9). Every write a scene asks
// for passes through here: values are quantised, rates capped, glow rises
// slew-limited, beats spaced and perches counted. The rate limit counts writes, not
// calls: a value that arrives inside a rate gap is kept per variable and written with
// the next allowed write, or by flush() when the scene stops writing.

import type { CardVarName, CardVars, Limiter, LimiterFlush, RootVarName, RootVars } from "./types";

export const QUANT = 1 / 64;
export const RATE_HZ = 15;
/** Calls this soon after a call that opened a write join that write (the same frame). */
export const BURST_MS = 8;
/** Largest w-glow rise per second; 0 to 1 takes at least 1 / 1.8 s. */
export const GLOW_RISE_PER_S = 1.8;
export const BEAT_CARD_MS = 2000;
export const BEATS_PER_S = 3;
export const BEAT_PAGE_MS = 800;
export const PERCH_MAX = 3;
export const LABEL_MS = 2500;
/** At most one scene announcement per this long on a page. */
export const ANNOUNCE_MS = 10_000;

const MIN_GAP_MS = 1000 / RATE_HZ;
/** Glow slew uses at most this much elapsed time per write, so a late call cannot jump. */
const MAX_SLEW_DT_S = 2 / RATE_HZ;

export function quantise(v: number, step = QUANT): number {
  return Math.round(v / step) * step;
}

/** Whole degrees. */
export function quantiseAngle(deg: number): number {
  return Math.round(deg);
}

const quantiseRoot = (name: RootVarName, v: number) => (name === "w-sun" ? quantiseAngle(v) : quantise(v));
const quantiseCard = (_: CardVarName, v: number) => quantise(v);

function finiteEntries<K extends string>(vars: Partial<Record<K, number>>, q: (name: K, v: number) => number): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  for (const name of Object.keys(vars) as K[]) {
    const raw = vars[name];
    if (raw !== undefined && Number.isFinite(raw)) out[name] = q(name, raw);
  }
  return out;
}

const isEmpty = (o: object) => Object.keys(o).length === 0;

interface CardRecord {
  /** When the current rate window opened. */
  at: number;
  /** Calls before this time join the write that opened the window. */
  burstUntil: number;
  /** Highest w-glow allowed inside the current window. */
  glowCap: number;
  /** Values the DOM shows. */
  values: CardVars;
  /** Values deferred by the rate limit (w-glow: the target a slew has not reached yet). */
  pending: CardVars;
}

export function createLimiter(now: () => number): Limiter {
  let still = false;
  let rootAt = -Infinity;
  let rootBurstUntil = -Infinity;
  let rootValues: RootVars = {};
  let rootPending: RootVars = {};
  let cards = new Map<string, CardRecord>();
  const beatLast = new Map<string | null, { at: number; value: "a" | "b" }>();
  let beatTimes: number[] = [];
  let perches = new Set<number>();
  let nextPerch = 1;

  /** Root write of the merged pending and given values, when the rate allows. */
  const writeRoot = (q: RootVars, t: number, fromCall: boolean): RootVars | null => {
    const open = t >= rootAt + MIN_GAP_MS;
    if (!open && !(fromCall && t < rootBurstUntil)) {
      for (const name of Object.keys(q) as RootVarName[]) {
        if (rootValues[name] === q[name]) delete rootPending[name];
        else rootPending[name] = q[name];
      }
      return null;
    }
    const merged: RootVars = { ...rootPending, ...q };
    rootPending = {};
    const out: RootVars = {};
    for (const name of Object.keys(merged) as RootVarName[]) {
      if (rootValues[name] !== merged[name]) out[name] = merged[name];
    }
    if (isEmpty(out)) return null;
    if (open) {
      rootAt = t;
      rootBurstUntil = fromCall ? t + BURST_MS : -Infinity;
    }
    Object.assign(rootValues, out);
    return out;
  };

  /** Card write of the merged pending and given values, slew-limited, when the rate allows. */
  const writeCard = (record: CardRecord, q: CardVars, t: number, fromCall: boolean): CardVars | null => {
    const open = t >= record.at + MIN_GAP_MS;
    if (!open && !(fromCall && t < record.burstUntil)) {
      for (const name of Object.keys(q) as CardVarName[]) {
        if (record.values[name] === q[name]) delete record.pending[name];
        else record.pending[name] = q[name];
      }
      return null;
    }
    if (open) {
      const dt = Number.isFinite(record.at) ? Math.min((t - record.at) / 1000, MAX_SLEW_DT_S) : 1 / RATE_HZ;
      // Registered initial value of --w-glow is 0, so an unknown previous value is 0.
      record.glowCap = (record.values["w-glow"] ?? 0) + GLOW_RISE_PER_S * dt;
    }
    const merged: CardVars = { ...record.pending, ...q };
    record.pending = {};
    const out: CardVars = {};
    for (const name of Object.keys(merged) as CardVarName[]) {
      let v = merged[name] as number;
      if (name === "w-glow" && v > record.glowCap) {
        record.pending[name] = v;
        v = Math.floor(record.glowCap / QUANT) * QUANT;
      }
      if (record.values[name] !== v) out[name] = v;
    }
    if (isEmpty(out)) return null;
    if (open) {
      record.at = t;
      record.burstUntil = fromCall ? t + BURST_MS : -Infinity;
    }
    record.values = { ...record.values, ...out };
    return out;
  };

  const cardRecord = (slug: string): CardRecord => {
    let record = cards.get(slug);
    if (!record) {
      record = { at: -Infinity, burstUntil: -Infinity, glowCap: 0, values: {}, pending: {} };
      cards.set(slug, record);
    }
    return record;
  };

  return {
    root(vars: RootVars) {
      if (still) return null;
      const q = finiteEntries(vars, quantiseRoot);
      if (isEmpty(q)) return null;
      return writeRoot(q, now(), true);
    },

    card(slug, vars, intersecting) {
      if (still) return null;
      if (!intersecting) {
        const record = cards.get(slug);
        if (record) record.pending = {};
        return null;
      }
      const q = finiteEntries(vars, quantiseCard);
      if (isEmpty(q)) return null;
      return writeCard(cardRecord(slug), q, now(), true);
    },

    flush(intersecting): LimiterFlush {
      const result: LimiterFlush = { root: null, cards: [] };
      if (still) return result;
      const t = now();
      if (!isEmpty(rootPending)) result.root = writeRoot({}, t, false);
      for (const [slug, record] of cards) {
        if (isEmpty(record.pending)) continue;
        if (!intersecting(slug)) {
          record.pending = {};
          continue;
        }
        const out = writeCard(record, {}, t, false);
        if (out) result.cards.push([slug, out]);
      }
      return result;
    },

    pendingAt() {
      if (still) return null;
      let at = isEmpty(rootPending) ? Infinity : rootAt + MIN_GAP_MS;
      for (const record of cards.values()) {
        if (!isEmpty(record.pending)) at = Math.min(at, record.at + MIN_GAP_MS);
      }
      return at === Infinity ? null : at;
    },

    seed(slug, vars) {
      Object.assign(cardRecord(slug).values, finiteEntries(vars, quantiseCard));
    },

    seedRoot(vars) {
      Object.assign(rootValues, finiteEntries(vars, quantiseRoot));
    },

    beat(slug) {
      if (still) return null;
      const t = now();
      beatTimes = beatTimes.filter((at) => t - at < 1000);
      if (beatTimes.length >= BEATS_PER_S) return null;
      const last = beatLast.get(slug);
      const gap = slug === null ? BEAT_PAGE_MS : BEAT_CARD_MS;
      if (last && t - last.at < gap) return null;
      const value = last?.value === "a" ? "b" : "a";
      beatLast.set(slug, { at: t, value });
      beatTimes.push(t);
      return value;
    },

    perch(composed = false) {
      if ((still && !composed) || perches.size >= PERCH_MAX) return 0;
      const id = nextPerch++;
      perches.add(id);
      return id;
    },

    unperch(id) {
      return perches.delete(id);
    },

    get still() {
      return still;
    },

    setStill(next) {
      if (next && !still) {
        // The still composition writes the DOM directly: deferred values are void, and the
        // first write after resume must not wait on a rate window opened before the pause.
        // Written values stay known, so later writes compare and slew from what the DOM shows.
        rootPending = {};
        rootAt = -Infinity;
        rootBurstUntil = -Infinity;
        for (const record of cards.values()) {
          record.pending = {};
          record.at = -Infinity;
          record.burstUntil = -Infinity;
        }
      }
      still = next;
    },

    reset() {
      rootAt = -Infinity;
      rootBurstUntil = -Infinity;
      rootValues = {};
      rootPending = {};
      cards = new Map();
      // Keep each target's last beat value so the next beat still alternates and restarts its animation.
      for (const record of beatLast.values()) record.at = -Infinity;
      beatTimes = [];
      perches = new Set();
    },
  };
}
