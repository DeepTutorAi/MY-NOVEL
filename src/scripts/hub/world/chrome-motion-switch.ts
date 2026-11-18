// The pause switch in the picker sheet (spec 2.16, 2.20), loaded with the picker. Only a
// scene that runs on the kit stops for it, so the switch is shown once the active theme's
// scene reports ready or still on hub:scene. Under the OS reduced-motion setting it shows
// as on and disabled, with the helper line chosen by CSS from the same media query.

import { last, on } from "./bus";
import { disposeAll, listen, reducedMotionQuery, type Off } from "./chrome-dom";
import { isPaused, setPaused } from "./chrome-motion";
import { activeThemeKey } from "./chrome-theme";
import type { HubEventMap } from "./types";

export function setupMotionSwitch(picker: HTMLElement): Off {
  const group = picker.querySelector<HTMLElement>("[data-hub-motion-group]");
  const switches = [...picker.querySelectorAll<HTMLElement>("[data-hub-motion-switch]")];
  const query = reducedMotionQuery();

  const render = (scene: HubEventMap["hub:scene"] | undefined = last("hub:scene")) => {
    const reduced = query.matches;
    const kitScene = scene?.key === activeThemeKey() && scene.status !== "failed";
    if (group) group.hidden = !(reduced || kitScene);
    for (const control of switches) {
      control.setAttribute("aria-checked", String(isPaused() || reduced));
      if (reduced) control.setAttribute("aria-disabled", "true");
      else control.removeAttribute("aria-disabled");
    }
  };

  const offs: Off[] = [on("hub:scene", (detail) => render(detail)), on("hub:theme", () => render())];
  for (const control of switches) {
    offs.push(
      listen(control, "click", () => {
        if (query.matches) return;
        setPaused(!isPaused());
        render();
      }),
    );
  }
  const onQuery = () => render();
  query.addEventListener("change", onQuery);
  offs.push(() => query.removeEventListener("change", onQuery));

  render();
  return () => {
    disposeAll(offs);
  };
}
