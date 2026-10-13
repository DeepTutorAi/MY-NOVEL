// The finale on the home page (design section 8.2): the mirrored scene flips
// in once, the first time the reader comes home after chapter 18, and a
// handwritten note shows when the next round begins.

export const FINALE_SEEN_KEY = "hvitveldt:finale:seen";

/** True the first time it is asked (and records that); false afterwards or when storage is unusable. */
export function consumeFinaleFlip(storage: Storage): boolean {
  try {
    if (storage.getItem(FINALE_SEEN_KEY)) return false;
    storage.setItem(FINALE_SEEN_KEY, new Date().toISOString());
    return true;
  } catch {
    return false;
  }
}
