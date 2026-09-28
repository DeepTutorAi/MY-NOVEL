// Lazy scene registry for arc-entry cutscenes. Each scene is its own chunk and
// is only fetched on the entry chapter that names it. Scenes hold no arc
// titles or chapter text: everything they show comes from the server-rendered
// dialog, so an unpublished arc's material never ships inside a script.
import type { gsap as Gsap } from "gsap";
import type { CutsceneSfx } from "./sfx";

export type SceneId = "rain-on-glass" | "porthole" | "dossier" | "sealed-depth";

export interface SceneContext {
  /** Decorative layers for the scene (aria-hidden). */
  stage: HTMLElement;
  /** Visible title text; its real text stays available to screen readers. */
  titleEl: HTMLElement;
  arcLabelEl: HTMLElement;
  /** Present only when the reader has Sea audio on. */
  sfx: CutsceneSfx | null;
  gsap: typeof Gsap;
}

/** Scenes set up synchronously; dispose() undoes everything they added. */
export interface SceneHandle {
  /** Ends with the scene's exit; the runner closes the dialog on completion. */
  timeline: gsap.core.Timeline;
  dispose(): void;
}

export interface SceneModule {
  play(ctx: SceneContext): SceneHandle;
}

const loaders: Record<SceneId, () => Promise<SceneModule>> = {
  "rain-on-glass": () => import("./scenes/rain-on-glass"),
  porthole: () => import("./scenes/porthole"),
  dossier: () => import("./scenes/dossier"),
  "sealed-depth": () => import("./scenes/sealed-depth"),
};

export const isSceneId = (value: unknown): value is SceneId =>
  typeof value === "string" && Object.hasOwn(loaders, value);

/** Unknown ids fall back to the neutral sealed-depth scene. */
export function loadScene(id: string | undefined): Promise<SceneModule> {
  return loaders[isSceneId(id) ? id : "sealed-depth"]();
}
