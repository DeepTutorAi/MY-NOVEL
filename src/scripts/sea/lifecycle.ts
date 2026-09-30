// Page lifecycle helper for Sea client scripts under the Astro ClientRouter.
// The behaviour lives in src/scripts/_shared/lifecycle.ts (see its header for
// why listeners go on `document` and how double setup is avoided); this wrapper
// fixes the Sea page marker and keeps the window.__seaBound record where it
// always was.
import { onPage } from "../_shared/lifecycle";

type Cleanup = () => void;

declare global {
  interface Window {
    __seaBound?: Record<string, true>;
  }
}

export function onSeaPage(name: string, setup: () => Cleanup | void): void {
  onPage(name, { bodyClass: "sea-page", registry: "__seaBound" }, setup);
}
