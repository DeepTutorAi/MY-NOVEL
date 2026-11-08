// The developer shortcut's form, the same on every novel. It needs in `root`: [data-dev-key] (the
// part that disappears during a lock), [data-bypass-input], [data-bypass-btn], [data-bypass-error]
// and [data-bypass-hint].
import { createAttemptTracker, type AttemptPolicy } from "./attempt-limit";
import { deriveDevToken, isDevToken, saveDevBypass } from "./dev-key";

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEV_ATTEMPTS_KEY = "piichan-novels:dev-attempts";
export const DEV_ATTEMPT_POLICY: AttemptPolicy = { hintAfter: 3, lockAfter: 5, windowMs: DAY_MS, lockMs: DAY_MS };
export const DEV_KEY_HINT = "ก่อนจะมีสักเรื่องบนเว็บนี้ คุณตั้งชื่อนี้ให้กล่องเปล่าใบหนึ่ง";

export interface DevKeyFormOptions {
  root: ParentNode;
  /** The novel's own "extra-bypassed" key. */
  storageKey: string;
  signal: AbortSignal;
  onOpen(): void | Promise<void>;
}

export function bindDevKeyForm({ root, storageKey, signal, onOpen }: DevKeyFormOptions): void {
  const form = root.querySelector<HTMLElement>("[data-dev-key]");
  const input = root.querySelector<HTMLInputElement>("[data-bypass-input]");
  const button = root.querySelector<HTMLButtonElement>("[data-bypass-btn]");
  const error = root.querySelector<HTMLElement>("[data-bypass-error]");
  const hint = root.querySelector<HTMLElement>("[data-bypass-hint]");
  if (!form || !input || !button) return;

  const tracker = createAttemptTracker(DEV_ATTEMPTS_KEY, DEV_ATTEMPT_POLICY);
  const paint = () => {
    const status = tracker.status();
    form.hidden = status.locked;
    if (hint) {
      hint.hidden = !status.showHint;
      hint.textContent = status.showHint ? DEV_KEY_HINT : "";
    }
  };

  let busy = false;
  const submit = async () => {
    const password = input.value.trim();
    if (!password || busy || tracker.status().locked) return;
    busy = true;
    button.disabled = true;
    // Counted before the slow step, so closing the tab during it does not skip the try.
    tracker.wrong();
    let token = "";
    try {
      token = await deriveDevToken(password);
    } catch (reason) {
      console.warn("[dev key] could not check the password", reason);
    }
    const ok = await isDevToken(token);
    busy = false;
    button.disabled = false;
    if (signal.aborted) return;
    input.value = "";
    if (error) error.hidden = ok;
    if (!ok) {
      paint();
      if (!form.hidden) input.focus();
      return;
    }
    tracker.clear();
    paint();
    try {
      saveDevBypass(token, window.localStorage, storageKey);
    } catch {
      // Restricted storage: the page still opens for this visit.
    }
    await onOpen();
  };

  button.addEventListener("click", () => void submit(), { signal });
  input.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter") void submit();
    },
    { signal },
  );
  paint();
}
