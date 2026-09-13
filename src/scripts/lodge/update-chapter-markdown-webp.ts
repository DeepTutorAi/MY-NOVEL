import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const chaptersDir = join(process.cwd(), "src/content/lodge/chapters");

async function updateChapters() {
  const files = await readdir(chaptersDir);
  let updatedCount = 0;
  let totalReplacements = 0;

  for (const file of files) {
    if (file.endsWith(".md")) {
      const filePath = join(chaptersDir, file);
      const content = await readFile(filePath, "utf8");
      
      const pattern = /assets\/lodge\/images\/chapters\/([A-Za-z0-9_-]+)\.png/g;
      const matches = content.match(pattern);

      if (matches && matches.length > 0) {
        const newContent = content.replace(pattern, "assets/lodge/images/chapters/$1.webp");
        await writeFile(filePath, newContent, "utf8");
        updatedCount++;
        totalReplacements += matches.length;
        console.log(`✓ Updated ${file} (${matches.length} images -> .webp)`);
      }
    }
  }

  console.log(`\nUpdated ${updatedCount} chapter files with ${totalReplacements} image links.`);
}

updateChapters().catch(console.error);
