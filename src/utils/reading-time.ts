/**
 * Render a reading-time estimate in minutes as friendly Thai text.
 * Under an hour stays as "N นาที"; longer spans collapse into "H ชม M นาที"
 * so a 203-minute section reads as "3 ชม 23 นาที" rather than a bare minute count.
 */
export function formatReadingTime(minutes: number | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) {
    return "—";
  }
  if (minutes < 60) {
    return `${minutes} นาที`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} ชม ${rest} นาที` : `${hours} ชม`;
}
