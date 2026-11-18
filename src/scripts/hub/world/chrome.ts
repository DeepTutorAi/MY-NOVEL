// Eager hub chrome module. On every hub page-load it builds the page model, wires
// dialogs, the picker and pause switch, attention, press, pick, the footer next step,
// runtime card writes and scene announcements, then binds the active theme's scene.
// The hit buttons, the card pointer variables, the scene-output handlers and the guide
// load with the chrome-later chunk when the page is idle, when a scene first reports
// (hub:scene) or on the first hub:out-* event, which is queued until then. Teardown on
// the next page change stops every scene and disposes all of it.

import { onPage, type PageCleanup } from "../../_shared/lifecycle";
import { themeByKey } from "../theme-core.mjs";
import { bus, emit, on, resetSticky } from "./bus";
import { setupAttention } from "./chrome-attention";
import { announce, disposeAll, globals, listen, loadLater, type Off } from "./chrome-dom";
import { setupFooter } from "./chrome-footer";
import { setupMotion } from "./chrome-motion";
import { setupPick } from "./chrome-pick";
import { setupPicker } from "./chrome-picker";
import { setupRuntime } from "./chrome-runtime";
import { activeThemeKey, bindTheme, cleanupScenes, resetSwitch, sceneLive, setNavigating } from "./chrome-theme";
import type { OutName, OutRecord } from "./chrome-world";
import { setupDialogs } from "./dialogs";
import { disposePageModel, getPageModel } from "./page-model";
import type { PageModel } from "./types";

export { activeThemeKey, bindTheme, cleanupScenes } from "./chrome-theme";

const OUT_EVENTS: readonly OutName[] = ["hub:out-perch", "hub:out-unperch", "hub:out-label", "hub:out-focus"];
const ANNOUNCE_EVENT = "hub:out-announce";

/** Scene text for the polite live region (Output.announce), handled eagerly. */
function setupAnnounce(): Off {
  const onAnnounce = (event: Event) => {
    const text = (event as CustomEvent<{ text?: unknown } | null>).detail?.text;
    if (typeof text === "string" && text.trim()) announce(text);
  };
  document.addEventListener(ANNOUNCE_EVENT, onAnnounce);
  return () => document.removeEventListener(ANNOUNCE_EVENT, onAnnounce);
}

/** Runs one setup; a throwing setup is logged and leaves the others running. */
function attempt(setup: () => Off): Off | null {
  try {
    return setup();
  } catch (error) {
    console.error(error);
    return null;
  }
}

function setupLater(page: PageModel | null): Off {
  const queue: OutRecord[] = [];
  let off: Off | null = null;
  let done = false;
  const load = () => {
    loadLater()
      .then(({ setupHits, setupPointerVars, setupWorld }) => {
        if (done || off) return;
        disposeAll(queueing);
        // Hits sync from the sticky hub:scene, so a scene that reported first still enables them.
        const offs = [attempt(setupHits), attempt(setupPointerVars), page ? attempt(() => setupWorld(page, queue.splice(0))) : null];
        off = () => disposeAll(offs.filter((o): o is Off => o !== null));
      })
      .catch((error: unknown) => console.error(error));
  };
  const queueing: Off[] = [
    ...OUT_EVENTS.map((name) =>
      on(name, (detail) => {
        queue.push([name, detail] as OutRecord);
        load();
      }),
    ),
    on("hub:scene", load),
  ];
  const hasIdle = "requestIdleCallback" in window;
  const idle = hasIdle ? requestIdleCallback(load, { timeout: 3000 }) : window.setTimeout(load, 1500);
  return () => {
    done = true;
    if (hasIdle) cancelIdleCallback(idle);
    else window.clearTimeout(idle);
    disposeAll(queueing);
    off?.();
  };
}

export function setupChrome(): PageCleanup {
  const offs: Off[] = [];
  const run = (setup: () => Off) => {
    const off = attempt(setup);
    if (off) offs.push(off);
  };

  const g = globals();
  const softReturn = g.__hubSoftArrival === true;
  delete g.__hubSoftArrival;

  let page: PageModel | null = null;
  try {
    page = getPageModel();
  } catch (error) {
    console.error(error);
  }

  run(() => setupDialogs(bus));
  run(setupMotion);
  run(() => setupPicker(page));
  run(setupFooter);
  run(setupAnnounce);
  if (page) {
    const model = page;
    run(() => setupAttention(model));
    run(() => setupPick(model));
    run(() => setupRuntime(model));
  }
  run(() => setupLater(page));
  offs.push(
    listen(document, "astro:before-preparation", () => setNavigating(true)),
    listen(window, "pageshow", (event) => {
      const key = activeThemeKey();
      if (event.persisted && !sceneLive(key)) bindTheme(key, { softReturn: true });
    }),
  );

  const key = activeThemeKey();
  bindTheme(key, { softReturn });
  const param = new URLSearchParams(location.search).get("theme");
  emit("hub:theme", { key, previous: null, source: themeByKey(param)?.key === key ? "param" : "load" });

  return () => {
    disposeAll(offs);
    resetSwitch();
    cleanupScenes();
    disposePageModel();
    resetSticky();
  };
}

onPage("hub-chrome", { bodyClass: "hub-page" }, setupChrome);
