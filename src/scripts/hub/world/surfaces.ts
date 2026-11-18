// Offscreen surface ledger for hub scenes: every canvas a scene paints offscreen
// goes through here, so the kit can release them all and report live bytes.

import { release, surface } from "../scene-paint";
import type { Surface, SurfaceFactory, Surfaces } from "./types";

export function createSurfaces(factory: SurfaceFactory = { surface, release }): Surfaces {
  const live = new Set<Surface>();
  let created = 0;
  let released = 0;

  const drop = (s: Surface) => {
    live.delete(s);
    factory.release(s.canvas);
    released++;
  };

  return {
    create(w, h) {
      const s = factory.surface(w, h);
      live.add(s);
      created++;
      return s;
    },
    release(s) {
      if (live.has(s)) drop(s);
    },
    releaseAll() {
      for (const s of [...live]) drop(s);
    },
    get liveBytes() {
      let bytes = 0;
      for (const s of live) bytes += s.canvas.width * s.canvas.height * 4;
      return bytes;
    },
    get created() {
      return created;
    },
    get released() {
      return released;
    },
  };
}
