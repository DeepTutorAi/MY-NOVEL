/**
 * Tsukinomi background image pipeline.
 *
 * Reads the author-supplied source JPGs in `public/assets/tsukinomi/images/`
 * (hero + 5 section backgrounds), downscales them for the web (no cropping —
 * CSS `background-size: cover` adapts per viewport), and emits AVIF + WebP + JPG
 * for each. The backdrop consumes them via an `image-set()` in the layout, with
 * the per-section procedural gradient still in place as the fallback.
 *
 * Run once after dropping new sources:
 *   pnpm exec tsx src/scripts/tsukinomi/process-images.ts
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const imagesDir = join(process.cwd(), "public/assets/tsukinomi/images");

// Slot bases relative to imagesDir; each has a source `<base>.jpg`.
const SLOTS = [
  "hero-station",
  "backgrounds/section-01",
  "backgrounds/section-02",
  "backgrounds/section-03",
  "backgrounds/section-04",
  "backgrounds/section-05",
] as const;

// Cap the longest edge; backgrounds sit behind prose at low opacity so this is plenty.
const MAX_EDGE = 2200;

async function processSlot(base: string): Promise<void> {
  const source = join(imagesDir, `${base}.jpg`);
  const buffer = await readFile(source); // read first so we can safely overwrite <base>.jpg
  const meta = await sharp(buffer).metadata();

  const pipeline = sharp(buffer)
    .rotate() // honor EXIF orientation
    .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true });

  const out = join(imagesDir, base);
  await pipeline.clone().avif({ quality: 42 }).toFile(`${out}.avif`);
  await pipeline.clone().webp({ quality: 60 }).toFile(`${out}.webp`);
  await pipeline.clone().jpeg({ quality: 72, mozjpeg: true }).toFile(`${out}.jpg`);

  console.log(`${base}: ${meta.width}x${meta.height} -> max ${MAX_EDGE}px  [avif + webp + jpg]`);
}

for (const base of SLOTS) {
  await processSlot(base);
}

console.log("All Tsukinomi background images processed.");
