// The developer shortcut's one password, shared by Lodge, Tsukinomi and Kusabi. Only a salt and a
// check value live here, so the password is not in the repo. `pnpm dev-key:set` writes them.
export const DEV_KEY_SALT = "bde5d7ce251fcce663710a98c2e7f09d";
export const DEV_KEY_ITERATIONS = 600_000;
export const DEV_KEY_CHECK = "61ad38649fe54273df19fd9d4006a2ce4fd939c380d2406ac0cd261e02010598";
export const DEV_KEY_TTL_MS = 3 * 24 * 60 * 60 * 1000;
export const DEV_BYPASS_KEYS = [
  "hvitveldt:extra-bypassed",
  "tsukinomi:extra-bypassed",
  "kusabi:extra-bypassed",
] as const;

export interface DevBypassStorage {
  getItem(key: string): string | null;
  setItem?(key: string, value: string): void;
  removeItem?(key: string): void;
}

const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");

const sha256Hex = async (text: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));

/** The token saved after a right password: slow to compute, and useless without the password. */
export async function deriveDevToken(password: string, salt: string = DEV_KEY_SALT, iterations: number = DEV_KEY_ITERATIONS): Promise<string> {
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations }, material, 256);
  return hex(bits);
}

export async function devTokenCheck(token: string): Promise<string> {
  return sha256Hex(token);
}

/** Packs a raw 64-hex token with a 3-day expiration timestamp (`<token>:<expiresAtMs>`). */
export function packDevToken(token: string, now: number = Date.now()): string {
  const rawToken = token.split(":")[0] ?? token;
  return `${rawToken}:${now + DEV_KEY_TTL_MS}`;
}

export function unpackDevToken(stored: string | null): { token: string; expiresAt: number | null } | null {
  if (!stored) return null;
  const trimmed = stored.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":");
  if (parts.length === 1) {
    return { token: parts[0], expiresAt: null };
  }
  if (parts.length === 2) {
    const expiresAt = Number(parts[1]);
    if (!Number.isFinite(expiresAt) || expiresAt <= 0) return null;
    return { token: parts[0], expiresAt };
  }
  return null;
}

export async function isDevToken(stored: string | null, now: number = Date.now()): Promise<boolean> {
  const unpacked = unpackDevToken(stored);
  if (!unpacked || !unpacked.token) return false;
  if (unpacked.expiresAt !== null && now >= unpacked.expiresAt) return false;
  try {
    return (await devTokenCheck(unpacked.token)) === DEV_KEY_CHECK;
  } catch {
    return false;
  }
}

/** Saves a verified token across all novels with a 3-day TTL. */
export function saveDevBypass(token: string, storage?: Pick<Storage, "setItem"> | null, extraKey?: string, now: number = Date.now()): string {
  const packed = token.includes(":") ? token : packDevToken(token, now);
  if (!storage) return packed;
  const keys = new Set<string>(DEV_BYPASS_KEYS);
  if (extraKey) keys.add(extraKey);
  for (const key of keys) {
    try {
      storage.setItem(key, packed);
    } catch {
      // Restricted storage: continue attempting remaining keys.
    }
  }
  return packed;
}

/**
 * Checks whether any novel holds a valid, non-expired developer token.
 * If found, syncs the packed 3-day token across all novels; if expired, cleans it up.
 */
export async function hasActiveDevBypass(storage?: DevBypassStorage | null, extraKey?: string, now: number = Date.now()): Promise<boolean> {
  if (!storage) return false;
  const keys = new Set<string>(DEV_BYPASS_KEYS);
  if (extraKey) keys.add(extraKey);

  let validPacked: string | null = null;
  const missingOrLegacyKeys: string[] = [];

  for (const key of keys) {
    let raw: string | null = null;
    try {
      raw = storage.getItem(key);
    } catch {
      raw = null;
    }
    if (!raw) {
      missingOrLegacyKeys.push(key);
      continue;
    }
    if (await isDevToken(raw, now)) {
      const unpacked = unpackDevToken(raw);
      if (unpacked) {
        if (unpacked.expiresAt === null) {
          missingOrLegacyKeys.push(key);
          validPacked ??= packDevToken(unpacked.token, now);
        } else {
          validPacked ??= raw;
        }
      }
    } else {
      try {
        storage.removeItem?.(key);
      } catch {
        // Ignore storage removal errors.
      }
      missingOrLegacyKeys.push(key);
    }
  }

  if (validPacked && storage.setItem && missingOrLegacyKeys.length > 0) {
    for (const key of missingOrLegacyKeys) {
      try {
        storage.setItem(key, validPacked);
      } catch {
        // Ignore storage write errors.
      }
    }
  }

  return validPacked !== null;
}
