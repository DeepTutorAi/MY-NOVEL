// Counts wrong passwords, in wall-clock time so that closing the tab does not end a wait.
// GitHub Pages has no server, so this lives in the browser: it slows a person at the form and
// cannot stop someone who clears site data. The cost of guessing comes from the key derivation.

export interface AttemptPolicy {
  /** Wrong tries before the hint appears. */
  hintAfter?: number;
  lockAfter: number;
  /** Tries older than this are forgotten. Without it, tries last until a lock or a right answer. */
  windowMs?: number;
  lockMs: number;
}

export interface AttemptState {
  wrong: number;
  firstWrongAt: number;
  lockedUntil: number;
}

export interface AttemptStatus {
  locked: boolean;
  lockedUntil: number;
  showHint: boolean;
  /** Wrong tries left before the lock. */
  left: number;
}

export const NO_ATTEMPTS: AttemptState = { wrong: 0, firstWrongAt: 0, lockedUntil: 0 };

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

export function parseAttempts(raw: string | null): AttemptState {
  if (!raw) return NO_ATTEMPTS;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return NO_ATTEMPTS;
    const { wrong, firstWrongAt, lockedUntil } = value as Record<string, unknown>;
    return isCount(wrong) && isCount(firstWrongAt) && isCount(lockedUntil) ? { wrong, firstWrongAt, lockedUntil } : NO_ATTEMPTS;
  } catch {
    return NO_ATTEMPTS;
  }
}

/** The state as of now: an ended lock and tries outside the window are gone. */
export function settleAttempts(state: AttemptState, now: number, policy: AttemptPolicy): AttemptState {
  if (state.lockedUntil > 0) {
    if (state.lockedUntil <= now) return NO_ATTEMPTS;
    // A clock set back must not stretch the wait beyond its length.
    return { ...state, lockedUntil: Math.min(state.lockedUntil, now + policy.lockMs) };
  }
  if (policy.windowMs !== undefined && state.wrong > 0 && now - state.firstWrongAt >= policy.windowMs) return NO_ATTEMPTS;
  return state;
}

export function recordWrong(state: AttemptState, now: number, policy: AttemptPolicy): AttemptState {
  const current = settleAttempts(state, now, policy);
  if (current.lockedUntil > now) return current;
  const wrong = current.wrong + 1;
  return {
    wrong,
    firstWrongAt: current.wrong === 0 ? now : current.firstWrongAt,
    lockedUntil: wrong >= policy.lockAfter ? now + policy.lockMs : 0,
  };
}

export function attemptStatus(state: AttemptState, now: number, policy: AttemptPolicy): AttemptStatus {
  const current = settleAttempts(state, now, policy);
  return {
    locked: current.lockedUntil > now,
    lockedUntil: current.lockedUntil,
    showHint: policy.hintAfter !== undefined && current.wrong >= policy.hintAfter,
    left: Math.max(0, policy.lockAfter - current.wrong),
  };
}

export interface AttemptTracker {
  status(): AttemptStatus;
  wrong(): void;
  clear(): void;
}

/** The rules above over localStorage. Keeps counting in memory where storage is blocked. */
export function createAttemptTracker(key: string, policy: AttemptPolicy, now: () => number = Date.now): AttemptTracker {
  let memory: string | null = null;
  const read = () => {
    try {
      return window.localStorage.getItem(key) ?? memory;
    } catch {
      return memory;
    }
  };
  const write = (value: string | null) => {
    memory = value;
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch {
      // Restricted storage: the count lasts until the page closes.
    }
  };
  return {
    status: () => attemptStatus(parseAttempts(read()), now(), policy),
    wrong: () => write(JSON.stringify(recordWrong(parseAttempts(read()), now(), policy))),
    clear: () => write(null),
  };
}
