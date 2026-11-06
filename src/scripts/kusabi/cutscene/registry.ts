// Which scene opens which chapter. Scenes are imported only when a cutscene will
// play, each as its own chunk. Chapters go by number and Extras by id, so Extra 4
// never shares a scene or a "played today" key with chapter 4.

export interface KusabiSceneContext {
  canvas: HTMLCanvasElement;
  stage: HTMLElement;
  /** The text being revealed. */
  text: string;
  /** Advances the epigraph; `fraction` of 0..1. */
  reveal(fraction: number): void;
  /** The scene's clock has run out. */
  complete(): void;
  signal: AbortSignal;
}

export interface KusabiSceneHandle {
  pause?(): void;
  dispose(): void;
}

export interface KusabiSceneModule {
  play(ctx: KusabiSceneContext): KusabiSceneHandle;
  still(ctx: KusabiSceneContext): void;
}

export const SCENE_CHAPTERS = [0, 4, 8, 11, 12] as const;

const narrator = () => import("./scenes/narrator");

const LOADERS = new Map<string, () => Promise<KusabiSceneModule>>([
  ["0", () => import("./scenes/water")],
  ["4", () => import("./scenes/threshold")],
  ["8", () => import("./scenes/corridor")],
  ["11", () => import("./scenes/monitors")],
  ["12", () => import("./scenes/reels")],
  ["e01", narrator],
  ["e02", narrator],
  ["e03", narrator],
  ["e04", narrator],
  ["e05", narrator],
]);

export function loadSceneFor(id: string): Promise<KusabiSceneModule> {
  const loader = LOADERS.get(id);
  if (!loader) return Promise.reject(new RangeError(`${id} has no cutscene`));
  return loader();
}
