import { readdir, stat, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, parse } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const targetDir = join(root, "public/assets/_shared/images");

async function convertFile(filePath: string): Promise<{ originalSize: number; newSize: number; name: string }> {
  const parsed = parse(filePath);
  const outPath = join(parsed.dir, `${parsed.name}.webp`);

  const originalStat = await stat(filePath);
  const originalSize = originalStat.size;

  // Convert with sharp (near-lossless for pixel art / high quality for photos)
  const isPixel = parsed.name.toLowerCase().includes("pixel");
  const sharpInstance = sharp(filePath);
  
  if (isPixel) {
    await sharpInstance.webp({ quality: 90, effort: 6, nearLossless: true }).toFile(outPath);
  } else {
    await sharpInstance.webp({ quality: 85, effort: 6 }).toFile(outPath);
  }

  if (!existsSync(outPath)) {
    throw new Error(`Failed to generate: ${outPath}`);
  }

  const newStat = await stat(outPath);
  if (newStat.size === 0) {
    throw new Error(`Generated file is empty: ${outPath}`);
  }

  // Delete original file
  await unlink(filePath);

  return {
    name: parsed.base,
    originalSize,
    newSize: newStat.size,
  };
}

async function main() {
  console.log("Starting _shared images conversion to WebP...");
  let totalOriginal = 0;
  let totalNew = 0;
  let count = 0;

  if (!existsSync(targetDir)) {
    throw new Error(`Target directory does not exist: ${targetDir}`);
  }

  const files = await readdir(targetDir, { withFileTypes: true });
  for (const file of files) {
    if (file.isFile() && (file.name.toLowerCase().endsWith(".png") || file.name.toLowerCase().endsWith(".jpg"))) {
      const fullPath = join(targetDir, file.name);
      const res = await convertFile(fullPath);
      totalOriginal += res.originalSize;
      totalNew += res.newSize;
      count++;
      console.log(`[${count}] ${res.name} -> ${parse(res.name).name}.webp (${(res.originalSize / 1024).toFixed(1)} KB -> ${(res.newSize / 1024).toFixed(1)} KB)`);
    }
  }

  console.log("\nConversion summary:");
  console.log(`Total files converted: ${count}`);
  console.log(`Original total size: ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`WebP total size: ${(totalNew / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Space saved: ${((totalOriginal - totalNew) / 1024 / 1024).toFixed(2)} MB (${(((totalOriginal - totalNew) / totalOriginal) * 100).toFixed(1)}%)`);
}

main().catch((err) => {
  console.error("Conversion failed:", err);
  process.exit(1);
});
