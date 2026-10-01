// Part number to cutscene: which scene module plays, how it is loaded and
// which assets it is allowed to use (design sections 4.3 and 5).
//
//   0 prologue            1 part-1-autumn-rain     2 part-2-twilight-lamp
//   3 part-3-warm-room    4 part-4-snow-pact       5 part-5-winter-light
//
// Scene modules are only ever reached through the loader below: a dynamic
// import() with a literal path, so the bundler splits each scene into its own
// chunk and nothing downloads it until the cutscene is about to play. Do not
// import a scene statically anywhere (cutscene-contract.test.ts enforces it).
//
// This module is pure: it imports no scene, no DOM and no audio code, so the
// server (TsukinomiCutscene.astro reads the scene id from it) and node:test can
// both import it. Asset roles are data; assetPathsFor() turns them into the
// public paths the contract test checks on disk, and resolveAssets() into the
// URLs a scene gets in ctx.assets.
import type { MusicCueId, SoundscapeId } from "../../../data/tsukinomi/music-cues";
import { getTsukinomiBackgroundSlot, type TsukinomiBackgroundSlotId } from "../../../data/tsukinomi/background-slots";
import type { SceneSfxId } from "./audio";
import type { TsukiIconId, TsukiSceneAssets, TsukiSceneModule } from "./scene-types";

/** What a scene may show. Audio roles sit next to it in the entry (cue, soundscapes, sfx). */
export interface TsukiAssetRoles {
  /** Section background used as the plate; null is a plain black plate. */
  readonly plate: TsukinomiBackgroundSlotId | null;
  readonly icons: readonly TsukiIconId[];
  /** Tape sound effects the scene plays through ctx.audio.sfx(). */
  readonly sfx: readonly SceneSfxId[];
}

export interface TsukiRegistryEntry {
  /** Scene id: the file name under ./scenes and the dialog's data-scene. */
  readonly id: string;
  /** Loads the scene module. Call it only when the cutscene is about to play. */
  readonly load: () => Promise<TsukiSceneModule>;
  readonly assets: TsukiAssetRoles;
  /** Music cue the scene switches the Walkman to (when it is on); null for none. */
  readonly cue: MusicCueId | null;
  /** Soundscapes the scene layers over the music (when the Walkman is on). */
  readonly soundscapes: readonly SoundscapeId[];
}

/** The parts that have a cutscene of their own. */
export const SCENE_PARTS = [0, 1, 2, 3, 4, 5] as const;
export type TsukiScenePart = (typeof SCENE_PARTS)[number];

const ENTRIES: Readonly<Record<TsukiScenePart, TsukiRegistryEntry>> = {
  0: {
    id: "prologue",
    load: () => import("./scenes/prologue"),
    assets: { plate: null, icons: ["walkman", "cassette-mark"], sfx: ["tape-click"] },
    cue: "discovery",
    soundscapes: ["cassette-hiss"],
  },
  1: {
    id: "part-1-autumn-rain",
    load: () => import("./scenes/part-1-autumn-rain"),
    assets: { plate: "section-01", icons: [], sfx: [] },
    cue: "discovery",
    soundscapes: ["distant-train"],
  },
  2: {
    id: "part-2-twilight-lamp",
    load: () => import("./scenes/part-2-twilight-lamp"),
    assets: { plate: "section-02", icons: [], sfx: ["tape-rewind"] },
    cue: "reveal",
    soundscapes: [],
  },
  3: {
    id: "part-3-warm-room",
    load: () => import("./scenes/part-3-warm-room"),
    assets: { plate: "section-03", icons: [], sfx: [] },
    cue: "decision",
    soundscapes: [],
  },
  4: {
    id: "part-4-snow-pact",
    load: () => import("./scenes/part-4-snow-pact"),
    assets: { plate: "section-04", icons: [], sfx: [] },
    cue: "mountain",
    soundscapes: ["mountain-wind"],
  },
  5: {
    id: "part-5-winter-light",
    load: () => import("./scenes/part-5-winter-light"),
    assets: { plate: "section-05", icons: [], sfx: [] },
    cue: "ten-years",
    soundscapes: [],
  },
};

/** The fallback for a part with no scene of its own: the epigraph on a black plate, silent. */
export const NEUTRAL_ENTRY: TsukiRegistryEntry = {
  id: "neutral",
  load: () => import("./scenes/neutral"),
  assets: { plate: null, icons: [], sfx: [] },
  cue: null,
  soundscapes: [],
};

export function isScenePart(part: number): part is TsukiScenePart {
  return Number.isInteger(part) && Object.hasOwn(ENTRIES, part);
}

/** The entry of a part; any part without a scene of its own gets the neutral epigraph-only scene. */
export function registryEntry(part: number): TsukiRegistryEntry {
  return isScenePart(part) ? ENTRIES[part] : NEUTRAL_ENTRY;
}

export function allRegistryEntries(): TsukiRegistryEntry[] {
  return [...SCENE_PARTS.map((part) => ENTRIES[part]), NEUTRAL_ENTRY];
}

const BACKGROUND_EXTENSIONS = ["avif", "webp", "jpg"] as const;
const iconPath = (id: TsukiIconId) => `/assets/tsukinomi/icons/${id}.svg`;
const sfxPath = (id: SceneSfxId) => `/assets/tsukinomi/audio/sfx/${id}.mp3`;

/**
 * Every public file the entry's asset roles point at, as site-relative paths
 * (`/assets/tsukinomi/...`, no base). Music and soundscapes are listed with
 * both the mp3 and ogg the Walkman can request.
 */
export function assetPathsFor(entry: TsukiRegistryEntry): string[] {
  const paths: string[] = [];
  if (entry.assets.plate) {
    const base = getTsukinomiBackgroundSlot(entry.assets.plate).expectedImageBase;
    for (const extension of BACKGROUND_EXTENSIONS) paths.push(`${base}.${extension}`);
  }
  for (const icon of entry.assets.icons) paths.push(iconPath(icon));
  for (const sfx of entry.assets.sfx) paths.push(sfxPath(sfx));
  for (const soundscape of entry.soundscapes) {
    paths.push(`/assets/tsukinomi/audio/soundscape/${soundscape}.mp3`, `/assets/tsukinomi/audio/soundscape/${soundscape}.ogg`);
  }
  if (entry.cue) {
    paths.push(`/assets/tsukinomi/audio/music/${entry.cue}.mp3`, `/assets/tsukinomi/audio/music/${entry.cue}.ogg`);
  }
  return paths;
}

/**
 * The URLs a scene gets in ctx.assets. `withBase` is src/utils/base-path's
 * withBase in the browser; it is a parameter so this stays free of
 * import.meta.env and runs under node:test.
 */
export function resolveAssets(roles: TsukiAssetRoles, withBase: (path: string) => string): TsukiSceneAssets {
  const icons: Partial<Record<TsukiIconId, string>> = {};
  for (const icon of roles.icons) icons[icon] = withBase(iconPath(icon));

  if (!roles.plate) return { backgroundCss: "none", backgroundUrl: null, icons };

  const base = getTsukinomiBackgroundSlot(roles.plate).expectedImageBase;
  // Same form as the page background in TsukinomiBaseLayout.astro.
  const backgroundCss =
    `image-set(` +
    `url("${withBase(`${base}.avif`)}") type("image/avif"), ` +
    `url("${withBase(`${base}.webp`)}") type("image/webp"), ` +
    `url("${withBase(`${base}.jpg`)}"))`;
  return { backgroundCss, backgroundUrl: withBase(`${base}.webp`), icons };
}
