// The pure half of the Extra train: where the carriage stands for a scroll position,
// and how pictures and empty windows alternate. Node --test covers all of it.

export interface TrainPicture {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
}

export type TrainWindow = { kind: "picture"; picture: TrainPicture; car: number; index: number } | { kind: "view" };

/** Empty windows sit between the pictures, so the night goes by outside before the next one. */
export function paceWindows(pictures: readonly TrainPicture[]): TrainWindow[] {
  const windows: TrainWindow[] = [{ kind: "view" }];
  pictures.forEach((picture, index) => {
    windows.push({ kind: "picture", picture, car: index + 1, index }, { kind: "view" });
  });
  return windows;
}

/** How far the carriage slides past the screen. */
export function trainTravel(trackWidth: number, viewportWidth: number): number {
  return Math.max(0, trackWidth - viewportWidth);
}

/** 0 at the start of the run, 1 at its end. One pixel of scroll moves the carriage one pixel. */
export function trainProgress(scrollY: number, runTop: number, travel: number): number {
  if (travel <= 0) return 0;
  return Math.min(1, Math.max(0, (scrollY - runTop) / travel));
}

/** The scroll position that brings a point on the track to the middle of the screen. */
export function scrollForPoint(point: number, runTop: number, travel: number, viewportWidth: number): number {
  return runTop + Math.min(travel, Math.max(0, point - viewportWidth / 2));
}
