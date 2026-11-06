// The developer shortcut's one password, shared by Lodge, Tsukinomi and Kusabi. Only a salt and a
// check value live here, so the password is not in the repo. `pnpm dev-key:set` writes them.
export const DEV_KEY_SALT = "bde5d7ce251fcce663710a98c2e7f09d";
export const DEV_KEY_ITERATIONS = 600_000;
export const DEV_KEY_CHECK = "61ad38649fe54273df19fd9d4006a2ce4fd939c380d2406ac0cd261e02010598";

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

export async function isDevToken(stored: string | null): Promise<boolean> {
  if (!stored) return false;
  try {
    return (await devTokenCheck(stored)) === DEV_KEY_CHECK;
  } catch {
    return false;
  }
}
