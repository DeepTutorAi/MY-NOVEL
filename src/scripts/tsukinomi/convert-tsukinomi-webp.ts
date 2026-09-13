import { readdir, stat, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, parse } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const targetDirs = [
  join(root, "public/assets/tsukinomi/images/illustrations"),
  join(root, "public/assets/tsukinomi/images/extra"),
];
const singleFiles = [
  join(root, "public/assets/tsukinomi/images/tsukinomi_pixel_hero.png"),
];

async function convertFile(filePath: string): Promise<{ originalSize: number; newSize: number; name: string }> {
  const parsed = parse(filePath);
  const outPath = join(parsed.dir, `${parsed.name}.webp`);

  const originalStat = await stat(filePath);
  const originalSize = originalStat.size;

  // Convert with sharp
  await sharp(filePath)
    .webp({ quality: 85, effort: 6 })
    .toFile(outPath);

  // Validate output
  if (!existsSync(outPath)) {
    throw new Error(`Failed to generate: ${outPath}`);
  }

  const newStat = await stat(outPath);
  if (newStat.size === 0) {
    throw new Error(`Generated file is empty: ${outPath}`);
  }

  // Safely delete original PNG
  await unlink(filePath);

  return {
    name: parsed.base,
    originalSize,
    newSize: newStat.size,
  };
}

async function main() {
  console.log("Starting Tsukinomi PNG to WebP conversion...");
  let totalOriginal = 0;
  let totalNew = 0;
  let count = 0;

  for (const dir of targetDirs) {
    const files = await readdir(dir);
    for (const file of files) {
      if (file.toLowerCase().endsWith(".png")) {
        const fullPath = join(dir, file);
        const res = await convertFile(fullPath);
        totalOriginal += res.originalSize;
        totalNew += res.newSize;
        count++;
        const savings = Math.round((1 - res.newSize / res.originalSize) * 100);
        console.log(`✓ Converted ${res.name}: ${(res.originalSize / 1024 / 1024).toFixed(2)} MB -> ${(res.newSize / 1024).toFixed(1)} KB (-${savings}%)`);
      }
    }
  }

  for (const filePath of singleFiles) {
    if (existsSync(filePath)) {
      const res = await convertFile(filePath);
      totalOriginal += res.originalSize;
      totalNew += res.newSize;
      count++;
      const savings = Math.round((1 - res.newSize / res.originalSize) * 100);
      console.log(`✓ Converted ${res.name}: ${(res.originalSize / 1024 / 1024).toFixed(2)} MB -> ${(res.newSize / 1024).toFixed(1)} KB (-${savings}%)`);
    }
  }

  console.log("\n================ Tsukinomi Conversion Summary ================");
  console.log(`Total files converted: ${count}`);
  console.log(`Original total size: ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`New total size:      ${(totalNew / 1024 / 1024).toFixed(2)} MB`);
  const totalSavings = Math.round((1 - totalNew / totalOriginal) * 100);
  console.log(`Total saved:         ${((totalOriginal - totalNew) / 1024 / 1024).toFixed(2)} MB (-${totalSavings}%)`);
  console.log("==============================================================");
}

main().catch((err) => {
  console.error("Conversion failed:", err);
  process.exit(1);
});
