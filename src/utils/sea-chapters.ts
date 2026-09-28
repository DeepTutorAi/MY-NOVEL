import { getCollection, type CollectionEntry } from "astro:content";
import { isSeaChapterVisible, sortSeaChapters } from "./sea-chapters-core";

export type SeaChapter = CollectionEntry<"seaChapters">;

/**
 * The single place that reads the Sea chapter collection. Draft chapters are
 * visible in dev only, so every consumer (home, routes, hub resume card)
 * shares the same PROD filter.
 */
export async function getSeaChapters(): Promise<SeaChapter[]> {
  const chapters = await getCollection("seaChapters", ({ data }) =>
    isSeaChapterVisible(data, import.meta.env.PROD),
  );
  return sortSeaChapters(chapters);
}
