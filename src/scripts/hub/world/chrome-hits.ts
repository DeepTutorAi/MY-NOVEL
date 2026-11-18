// Stage and mid hit buttons (spec 2.17): enabled once the active scene reports
// ready or still; click, Enter and Space tap, ArrowLeft and ArrowRight nudge.

import { emit, last, on } from "./bus";
import { disposeAll, listen, type Off } from "./chrome-dom";
import { activeThemeKey } from "./chrome-theme";
import type { HitWindowName, HubEventMap } from "./types";

const isHitWindow = (value: string | undefined): value is HitWindowName => value === "stage" || value === "mid";

export function setupHits(): Off {
  const hits = [...document.querySelectorAll<HTMLButtonElement>("button.hub-window-hit[data-hub-hit]")];
  if (hits.length === 0) return () => undefined;

  const sync = (scene: HubEventMap["hub:scene"] | undefined = last("hub:scene")) => {
    const enabled = Boolean(scene && scene.key === activeThemeKey() && (scene.status === "ready" || scene.status === "still"));
    for (const hit of hits) hit.disabled = !enabled;
  };

  const offs: Off[] = [on("hub:scene", (detail) => sync(detail)), on("hub:theme", () => sync())];
  for (const hit of hits) {
    const name = hit.dataset.hubHit;
    if (!isHitWindow(name)) continue;
    offs.push(
      listen(hit, "click", (event) => {
        const pointer = event.detail > 0 ? { x: event.clientX, y: event.clientY } : {};
        emit("hub:stage", { window: name, action: "tap", ...pointer });
      }),
      listen(hit, "keydown", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        emit("hub:stage", { window: name, action: event.key === "ArrowLeft" ? "left" : "right" });
      }),
    );
  }
  sync();
  return () => {
    disposeAll(offs);
  };
}
