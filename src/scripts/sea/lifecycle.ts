// Page lifecycle helper for Sea client scripts under the Astro ClientRouter.
//
// Astro 5 dispatches astro:page-load / astro:before-swap on `document` and the
// events do not bubble, so listeners must be attached to `document`, never to
// `window`. Module scripts run once per full page load, which can happen
// before or after the first astro:page-load, so setup runs both immediately
// (when the DOM is ready) and on astro:page-load, with a guard so the same
// page is never set up twice.

type Cleanup = () => void;

declare global {
  interface Window {
    __seaBound?: Record<string, true>;
  }
}

export function onSeaPage(name: string, setup: () => Cleanup | void): void {
  if (typeof window === "undefined") return;

  const bound = (window.__seaBound ??= {});
  if (bound[name]) return;
  bound[name] = true;

  let cleanup: Cleanup | null = null;
  // ClientRouter replaces document.body on every navigation, so the body
  // element identifies the page that is currently set up.
  let setupBody: HTMLElement | null = null;

  const teardown = () => {
    const fn = cleanup;
    cleanup = null;
    setupBody = null;
    fn?.();
  };

  const run = () => {
    const body = document.body;
    if (!body || body === setupBody) return;
    teardown();
    if (!body.classList.contains("sea-page")) return;
    setupBody = body;
    cleanup = setup() ?? null;
  };

  document.addEventListener("astro:page-load", run);
  document.addEventListener("astro:before-swap", teardown);

  if (document.readyState !== "loading") {
    run();
  }
}
