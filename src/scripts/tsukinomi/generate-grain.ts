import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const outputPath = join(process.cwd(), "public/assets/tsukinomi/textures/film-grain.png");
mkdirSync(dirname(outputPath), { recursive: true });

const result = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=0x7a6a55:s=256x256",
    "-vf",
    "noise=alls=38:allf=t+u,format=rgba,colorchannelmixer=aa=0.28",
    "-frames:v",
    "1",
    outputPath,
  ],
  { encoding: "utf8" },
);

if (result.status !== 0) {
  throw new Error(result.stderr || "ffmpeg failed while generating Tsukinomi film grain");
}

console.log(`Generated ${outputPath}`);
