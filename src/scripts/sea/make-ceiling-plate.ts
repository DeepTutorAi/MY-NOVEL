// Builds the still texture for the home hero's water ceiling (and its static
// fallback) by cropping the top band of the hub art. The crop keeps only
// water, the whale and the fish shoal: the figure, the ruins and the towers on
// both edges start below and outside this box, and the top 134px (a spindly
// wreck and a thin dangling fin that read as hanging figures) stay out too. Re-run after the
// source art changes and look at the output before shipping it.
//
//   pnpm exec tsx src/scripts/sea/make-ceiling-plate.ts
import { stat } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = join(root, "public/assets/sea/images/hub-sea-dark-adventure.webp");
const target = join(root, "public/assets/sea/images/ceiling-plate.webp");

export const CEILING_CROP = { left: 170, top: 134, width: 1080, height: 242 } as const;

async function main(): Promise<void> {
  const meta = await sharp(source).metadata();
  const { left, top, width, height } = CEILING_CROP;
  if (!meta.width || !meta.height || left + width > meta.width || top + height > meta.height) {
    throw new Error(`Crop ${JSON.stringify(CEILING_CROP)} does not fit ${meta.width}x${meta.height}`);
  }
  await sharp(source).extract(CEILING_CROP).webp({ quality: 82, effort: 6 }).toFile(target);
  const { size } = await stat(target);
  if (size === 0) throw new Error(`Empty output: ${target}`);
  console.log(`ceiling-plate.webp ${width}x${height} ${(size / 1024).toFixed(1)} KB`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
