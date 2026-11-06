// The gate on every Sea URL while the novel is closed (pages/sea/gate.astro). Right password:
// the page this gate carries is decrypted and written over the gate. The key is kept so the next
// page opens at once. Writing over the document is a full load, so the Sea page runs as it would
// from a link; between Sea pages the router also falls back to a full load, through this gate.
import { createAttemptTracker, type AttemptPolicy } from "../_shared/attempt-limit";
import { SEA_ATTEMPTS_KEY, SEA_KEY_STORAGE, deriveSeaKey, exportSeaKey, importSeaKey, normalizeSeaPassword, openSealed } from "./seal-core.mjs";

const HOUR_MS = 60 * 60 * 1000;
export const SEA_GATE_POLICY: AttemptPolicy = { lockAfter: 3, lockMs: 5 * HOUR_MS };

interface Sealed {
  iv: string;
  data: string;
}

const readSealed = (): Sealed | null => {
  const text = document.getElementById("sea-sealed")?.textContent?.trim();
  if (!text) return null;
  try {
    const value = JSON.parse(text) as Partial<Sealed>;
    return typeof value.iv === "string" && typeof value.data === "string" ? { iv: value.iv, data: value.data } : null;
  } catch {
    return null;
  }
};

const safeGet = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const showPage = (html: string): void => {
  document.open();
  document.write(html);
  document.close();
  // The browser looked for the fragment in the gate, which has none of the page's anchors.
  window.addEventListener(
    "load",
    () => {
      if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
    },
    { once: true },
  );
};

const showGate = (): void => document.documentElement.classList.remove("sea-gate-opening");

const lockMessage = (until: number): string => {
  const at = new Date(until);
  const time = at.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  const sameDay = at.toDateString() === new Date().toDateString();
  return `ใส่ผิดครบ 3 ครั้ง ลองใหม่ได้${sameDay ? "ตอน" : "พรุ่งนี้ตอน"} ${time} น.`;
};

const bindForm = (sealed: Sealed): void => {
  const row = document.querySelector<HTMLElement>("[data-gate-row]");
  const input = document.querySelector<HTMLInputElement>("[data-gate-input]");
  const button = document.querySelector<HTMLButtonElement>("[data-gate-open]");
  const error = document.querySelector<HTMLElement>("[data-gate-error]");
  const wait = document.querySelector<HTMLElement>("[data-gate-wait]");
  if (!row || !input || !button) return;

  const tracker = createAttemptTracker(SEA_ATTEMPTS_KEY, SEA_GATE_POLICY);
  const paint = () => {
    const status = tracker.status();
    row.hidden = status.locked;
    if (wait) {
      wait.hidden = !status.locked;
      wait.textContent = status.locked ? lockMessage(status.lockedUntil) : "";
    }
    if (error && status.locked) error.hidden = true;
  };

  let busy = false;
  const submit = async () => {
    const password = input.value;
    if (!normalizeSeaPassword(password) || busy || tracker.status().locked) return;
    busy = true;
    button.disabled = true;
    // Counted before the slow step, so closing the tab during it does not skip the try.
    tracker.wrong();
    let html: string | null = null;
    let saved = "";
    try {
      const key = await deriveSeaKey(password);
      html = await openSealed(sealed, key);
      saved = await exportSeaKey(key);
    } catch {
      html = null;
    }
    busy = false;
    button.disabled = false;
    if (html === null) {
      input.value = "";
      if (error) error.hidden = false;
      paint();
      if (!row.hidden) input.focus();
      return;
    }
    tracker.clear();
    try {
      window.localStorage.setItem(SEA_KEY_STORAGE, saved);
    } catch {
      // Restricted storage: this page opens, and the next one asks again.
    }
    showPage(html);
  };

  button.addEventListener("click", () => void submit());
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") void submit();
  });
  paint();
};

const start = async (): Promise<void> => {
  const sealed = readSealed();
  if (!sealed) {
    // Built without the password: there is nothing to open, so there is no form either.
    document.querySelector<HTMLElement>("[data-gate-dev]")?.toggleAttribute("hidden", true);
    showGate();
    return;
  }
  const stored = safeGet(SEA_KEY_STORAGE);
  if (stored) {
    try {
      showPage(await openSealed(sealed, await importSeaKey(stored)));
      return;
    } catch {
      // Saved for an older password.
      try {
        window.localStorage.removeItem(SEA_KEY_STORAGE);
      } catch {
        // Nothing more to do: the form is shown either way.
      }
    }
  }
  bindForm(sealed);
  showGate();
};

void start();
