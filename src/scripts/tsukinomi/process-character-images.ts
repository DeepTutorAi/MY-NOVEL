/**
 * Convert Tsukinomi character model-sheet PNGs to web-optimized WebP.
 *
 * Keeps the source `.png` (used as the <picture> fallback) and writes a capped
 * `.webp` beside it. The characters page serves WebP first, PNG as fallback.
 *
 *   pnpm exec tsx src/scripts/tsukinomi/process-character-images.ts
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const charDir = join(process.cwd(), "public/assets/tsukinomi/images/characters");
const MAX_EDGE = 1400;

const files = (await readdir(charDir)).filter((file) => file.toLowerCase().endsWith(".png"));

for (const file of files) {
  const source = join(charDir, file);
  const buffer = await readFile(source);
  const meta = await sharp(buffer).metadata();

  const target = join(charDir, file.replace(/\.png$/i, ".webp"));
  await sharp(buffer)
    .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(target);

  console.log(`${file}: ${meta.width}x${meta.height} -> webp`);
}

console.log(`Processed ${files.length} character images to WebP.`);
