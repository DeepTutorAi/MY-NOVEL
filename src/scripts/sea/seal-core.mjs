// Locks the Sea pages while the novel is closed. The same WebCrypto code encrypts at build time
// and opens in the browser. No password or check value is stored: a wrong password is simply a
// failed decrypt. This protects the deployed site only, since the chapters are in a public repo.

/** The one switch. Set to false to open the novel: pages ship plain and the hub shows its usual card. */
export const SEA_CLOSED = true;

export const SEA_KEY_STORAGE = "sea:site-key";
export const SEA_ATTEMPTS_KEY = "sea:gate-attempts";

const SALT = "piichan-novels:sea-gate:v1";
const ITERATIONS = 600_000;

const encoder = new TextEncoder();

/** @param {Uint8Array} bytes */
function toBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** @param {string} text */
function fromBase64(text) {
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}

/**
 * Capitals and spacing do not decide whether the password is right.
 * @param {string} text
 */
export function normalizeSeaPassword(text) {
  return text.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
}

/** @param {string} password */
export async function deriveSeaKey(password) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(normalizeSeaPassword(password)), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(SALT), iterations: ITERATIONS },
    material,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

/** @param {CryptoKey} key */
export async function exportSeaKey(key) {
  return toBase64(new Uint8Array(await crypto.subtle.exportKey("raw", key)));
}

/** @param {string} stored */
export function importSeaKey(stored) {
  return crypto.subtle.importKey("raw", fromBase64(stored), { name: "AES-GCM" }, true, ["decrypt"]);
}

/**
 * @param {string} text
 * @param {CryptoKey} key
 * @returns {Promise<{ iv: string, data: string }>}
 */
export async function sealText(text, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(text));
  return { iv: toBase64(iv), data: toBase64(new Uint8Array(data)) };
}

/**
 * Rejects when the key is wrong or the text was changed.
 * @param {{ iv: string, data: string }} sealed
 * @param {CryptoKey} key
 */
export async function openSealed(sealed, key) {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(sealed.iv) }, key, fromBase64(sealed.data));
  return new TextDecoder().decode(plain);
}
