// Which scene opens which chapter (design section 7.3). Scenes are imported
// only when a cutscene will play, each as its own chunk.
import type { LodgeSceneModule } from "./scene-types";

export const SCENE_CHAPTERS = [0, 1, 6, 13, 18] as const;
export type SceneChapter = (typeof SCENE_CHAPTERS)[number];

export interface LodgeRegistryEntry {
  chapter: SceneChapter;
  /** Scene id, also the name of its chunk. */
  id: string;
  load(): Promise<LodgeSceneModule>;
}

const ENTRIES: Record<SceneChapter, LodgeRegistryEntry> = {
  0: { chapter: 0, id: "notebook", load: () => import("./scenes/notebook") },
  1: { chapter: 1, id: "headlights", load: () => import("./scenes/headlights") },
  6: { chapter: 6, id: "paper", load: () => import("./scenes/paper") },
  13: { chapter: 13, id: "paper", load: () => import("./scenes/paper") },
  18: { chapter: 18, id: "paper", load: () => import("./scenes/paper") },
};

export function isSceneChapter(chapter: number): chapter is SceneChapter {
  return (SCENE_CHAPTERS as readonly number[]).includes(chapter);
}

export function registryEntry(chapter: number): LodgeRegistryEntry {
  if (!isSceneChapter(chapter)) throw new RangeError(`chapter ${chapter} has no cutscene`);
  return ENTRIES[chapter];
}
