// Page lifecycle helper for client scripts under the Astro ClientRouter,
// shared by every novel. Sea's onSeaPage (src/scripts/sea/lifecycle.ts) is a
// thin wrapper around onPage.
//
// Astro 5 dispatches astro:page-load / astro:before-swap on `document` and the
// events do not bubble, so listeners must be attached to `document`, never to
// `window`. Module scripts run once per full page load, which can happen
// before or after the first astro:page-load, so setup runs both immediately
// (when the DOM is ready) and on astro:page-load, with a guard so the same
// page is never set up twice.

export type PageCleanup = () => void;

export interface PageOptions {
  /** setup() runs only while document.body carries this class (the novel's page marker). */
  bodyClass: string;
  /**
   * Name of the window property holding the record of names already bound,
   * which survives the script being evaluated twice. Sea passes "__seaBound"
   * so its existing record stays where it was. The default record is shared by
   * every caller, so its keys are prefixed with bodyClass; a custom record is
   * keyed by name alone.
   */
  registry?: string;
}

const DEFAULT_REGISTRY = "__pageBound";

type BoundRecord = Record<string, true>;

export function onPage(name: string, options: PageOptions, setup: () => PageCleanup | void): void {
  if (typeof window === "undefined") return;

  const { bodyClass, registry = DEFAULT_REGISTRY } = options;
  const store = window as unknown as Record<string, BoundRecord | undefined>;
  const bound = (store[registry] ??= {});
  const key = registry === DEFAULT_REGISTRY ? `${bodyClass}:${name}` : name;
  if (bound[key]) return;
  bound[key] = true;

  let cleanup: PageCleanup | null = null;
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
    if (!body.classList.contains(bodyClass)) return;
    setupBody = body;
    cleanup = setup() ?? null;
  };

  document.addEventListener("astro:page-load", run);
  document.addEventListener("astro:before-swap", teardown);

  if (document.readyState !== "loading") {
    run();
  }
}
