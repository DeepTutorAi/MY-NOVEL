// The pace of the voice on the Extra chapters: steady along a line, with a breath at each line
// break. It counts the same clusters the reveal shows, so a breath falls exactly at a line's end.
import { revealClusters } from "../../lodge/cutscene/reveal-core";

export const CLUSTERS_PER_SECOND = 16;
export const LINE_BREATH_S = 0.55;

interface Beat {
  time: number;
  shown: number;
}

export interface NarrationPace {
  /** Seconds from the first character to the last. */
  duration: number;
  /** The share of the text shown at a share (0..1) of the duration. */
  pace(fraction: number): number;
}

export function narrationPace(text: string): NarrationPace {
  const clusters = revealClusters(text);
  const beats: Beat[] = [{ time: 0, shown: 0 }];
  let time = 0;
  clusters.forEach((cluster, index) => {
    if (cluster !== "\n") {
      time += 1 / CLUSTERS_PER_SECOND;
      return;
    }
    beats.push({ time, shown: index });
    time += LINE_BREATH_S;
    beats.push({ time, shown: index + 1 });
  });
  beats.push({ time, shown: clusters.length });

  const pace = (fraction: number): number => {
    if (clusters.length === 0 || !(fraction > 0)) return 0;
    if (fraction >= 1) return 1;
    const at = fraction * time;
    for (let i = 1; i < beats.length; i += 1) {
      const from = beats[i - 1];
      const to = beats[i];
      if (at > to.time) continue;
      const within = to.time > from.time ? (at - from.time) / (to.time - from.time) : 1;
      return (from.shown + within * (to.shown - from.shown)) / clusters.length;
    }
    return 1;
  };
  return { duration: time, pace };
}
