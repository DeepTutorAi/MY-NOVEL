// Auto-hiding Sea top bar. Hides after the reader scrolls down past
// HIDE_AFTER_PX and returns on scroll up. It stays visible while focus is
// inside it (CSS :focus-within) or while one of its controls has an open
// panel (aria-expanded="true"). body[data-topbar] mirrors the state so other
// fixed chrome (the mobile progress line) can follow it.

const HIDE_AFTER_PX = 160;
const DELTA_PX = 8;

export function bindTopBar(): (() => void) | undefined {
  const bar = document.querySelector<HTMLElement>("[data-sea-topbar]");
  if (!bar) return undefined;

  const body = document.body;
  let lastY = window.scrollY;
  let hidden = false;
  let frame = 0;

  const setHidden = (next: boolean) => {
    if (next === hidden) return;
    hidden = next;
    bar.classList.toggle("is-hidden", next);
    body.dataset.topbar = next ? "hidden" : "shown";
  };

  const hasOpenControl = () => bar.querySelector('[aria-expanded="true"]') !== null;

  const update = () => {
    frame = 0;
    const y = Math.max(0, window.scrollY);
    const delta = y - lastY;
    if (Math.abs(delta) < DELTA_PX) return;
    lastY = y;

    if (delta > 0 && y > HIDE_AFTER_PX && !hasOpenControl() && !bar.matches(":focus-within")) {
      setHidden(true);
    } else if (delta < 0) {
      setHidden(false);
    }
  };

  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  // Keyboard focus entering a hidden bar (e.g. Shift+Tab from the page)
  // must reveal it; CSS handles the visual part, this keeps the state honest.
  const onFocusIn = () => setHidden(false);

  body.dataset.topbar = "shown";
  window.addEventListener("scroll", onScroll, { passive: true });
  bar.addEventListener("focusin", onFocusIn);

  return () => {
    window.removeEventListener("scroll", onScroll);
    bar.removeEventListener("focusin", onFocusIn);
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };
}
