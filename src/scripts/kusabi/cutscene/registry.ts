// Which scene opens which chapter. Scenes are imported only when a cutscene will
// play, each as its own chunk.

export interface KusabiSceneContext {
  canvas: HTMLCanvasElement;
  stage: HTMLElement;
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
type SceneChapter = (typeof SCENE_CHAPTERS)[number];

const LOADERS: Record<SceneChapter, () => Promise<KusabiSceneModule>> = {
  0: () => import("./scenes/water"),
  4: () => import("./scenes/threshold"),
  8: () => import("./scenes/corridor"),
  11: () => import("./scenes/monitors"),
  12: () => import("./scenes/reels"),
};

export function loadSceneFor(chapter: number): Promise<KusabiSceneModule> {
  const loader = LOADERS[chapter as SceneChapter];
  if (!loader) return Promise.reject(new RangeError(`chapter ${chapter} has no cutscene`));
  return loader();
}
