// Contract between the Lodge cutscene adapter (index.ts) and a scene module
// (scenes/*.ts), design section 7.1. A scene draws on the canvas it is given,
// drives the epigraph's reveal, may add real buttons to `controls`, and calls
// complete() when its timeline is over. It never replaces the epigraph text.

export interface Reveal {
  /** Number of grapheme clusters in the epigraph. */
  readonly count: number;
  /** Shows the first `fraction` (0..1) of the clusters. */
  show(fraction: number): void;
  showAll(): void;
}

export interface LodgeSceneContext {
  chapter: number;
  /** aria-hidden stage that holds the canvas. */
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  /** The epigraph paragraph, real text, already wrapped for the reveal. */
  textEl: HTMLElement;
  /** Slot for the scene's own <button>s, outside the aria-hidden stage. */
  controls: HTMLElement;
  /** Aborted when the cutscene ends or is skipped. */
  signal: AbortSignal;
  /** True for the reduced-motion or motion-off still. */
  still: boolean;
  reveal: Reveal;
  /** URL of a file under /assets/lodge/images/, with the site base. */
  assetUrl(path: string): string;
  /** The scene's timeline is over; the dialog fades out. */
  complete(): void;
}

export interface LodgeSceneHandle {
  pause?(): void;
  dispose(): void;
}

export interface LodgeSceneModule {
  play(ctx: LodgeSceneContext): LodgeSceneHandle;
  still(ctx: LodgeSceneContext): void;
}
