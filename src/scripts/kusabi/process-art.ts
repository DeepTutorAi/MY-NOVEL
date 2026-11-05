// Builds every Kusabi website image that is not a chapter illustration from the
// untouched sources in output/kusabi-art-source/. Output names are neutral on
// purpose: a locked picture must not say who it shows.
//
//   pnpm exec tsx src/scripts/kusabi/process-art.ts
//
// Crop boxes are source pixels read off the sheets. Re-running overwrites the
// output and never changes a source file.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SOURCE = join(ROOT, "output/kusabi-art-source");
const PUBLIC = join(ROOT, "public/assets/kusabi/images");
const ILLUSTRATIONS = join(PUBLIC, "illustrations");

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Portrait {
  out: string;
  source: string;
  box: Box;
}

const SHEETS = "characters/drafts-v2";
const box = (left: number, top: number, width: number, height: number): Box => ({ left, top, width, height });

/** Character file portraits. f01 to f05 are public, the rest load only after their unlock. */
const PORTRAITS: Portrait[] = [
  { out: "files/f01.webp", source: `${SHEETS}/arai-ryoya-draft-v2.png`, box: box(500, 680, 320, 400) },
  { out: "files/f02.webp", source: `${SHEETS}/nao-amamiya-draft-v2.png`, box: box(1015, 20, 264, 330) },
  { out: "files/f03.webp", source: `${SHEETS}/kaito-sakuraba-draft-v2.png`, box: box(1004, 50, 264, 330) },
  { out: "files/f04.webp", source: `${SHEETS}/misaki-kurosawa-draft-v2.png`, box: box(20, 860, 290, 362) },
  { out: "files/f05.webp", source: `${SHEETS}/risa-asahina-draft-v2.png`, box: box(1162, 0, 264, 330) },
  { out: "files/f06.webp", source: `${SHEETS}/shion-madoka-caretaker-draft-v2.png`, box: box(975, 28, 264, 330) },
  { out: "files/f07.webp", source: `${SHEETS}/shion-madoka-killer-draft-v2.png`, box: box(1248, 15, 262, 328) },
  { out: "files/f08.webp", source: `${SHEETS}/shion-madoka-killer-unmasked-draft-v2.png`, box: box(1060, 5, 420, 525) },
  { out: "files/f09.webp", source: `${SHEETS}/ayame-hirasaka-draft-v2.png`, box: box(1074, 6, 372, 465) },
  // The sealed file: faces only, because the sheets' clothes say more than the file may.
  { out: "album/s01.webp", source: "extra/arai-ryoya-adult-boat-tourist.png", box: box(0, 1030, 208, 250) },
  { out: "album/s02.webp", source: "extra/kaito-sakuraba-adult-buzz-cut.png", box: box(1014, 16, 232, 290) },
  { out: "album/s03.webp", source: "extra/misaki-kurosawa-adult-office-center-part.png", box: box(844, 0, 300, 375) },
  { out: "album/s04.webp", source: "extra/nao-amamiya-adult-boat-tourist.png", box: box(885, 12, 280, 350) },
  { out: "album/s05.webp", source: "extra/risa-asahina-adult-dress-straight-bangs.png", box: box(945, 0, 300, 375) },
];

const POSTCARDS: Array<{ out: string; source: string }> = [
  { out: "album/a01.webp", source: "extra/risa-kaito-wedding-short-hair-special-1dea97b4.png" },
  { out: "album/a02.webp", source: "extra/misaki-twins-special-aa2d8800.png" },
  { out: "album/a03.webp", source: "extra/misaki-nao-ryoya-with-twins-age-26-special-b5b78ac1.png" },
];

const PORTRAIT_WIDTH = 480;
const PORTRAIT_HEIGHT = 600;

/** The pale sheet paper would glare on the dark pages, so the corners sink into shadow. */
function vignette(width: number, height: number): Buffer {
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="v" cx="50%" cy="44%" r="72%">
        <stop offset="48%" stop-color="#ffffff"/>
        <stop offset="82%" stop-color="#8d8782"/>
        <stop offset="100%" stop-color="#2c2926"/>
      </radialGradient></defs>
      <rect width="100%" height="100%" fill="url(#v)"/>
    </svg>`,
  );
}

function prepare(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  return path;
}

async function portrait({ out, source, box: area }: Portrait) {
  const base = await sharp(join(SOURCE, source))
    .extract(area)
    .resize(PORTRAIT_WIDTH, PORTRAIT_HEIGHT, { fit: "cover", kernel: "lanczos3" })
    .grayscale()
    .linear(0.74, 6)
    .toBuffer();
  await sharp(base)
    .composite([{ input: vignette(PORTRAIT_WIDTH, PORTRAIT_HEIGHT), blend: "multiply" }])
    .webp({ quality: 82 })
    .toFile(prepare(join(PUBLIC, out)));
}

async function postcard({ out, source }: { out: string; source: string }) {
  await sharp(join(SOURCE, source))
    .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
    .linear(0.92, 0)
    .webp({ quality: 80 })
    .toFile(prepare(join(PUBLIC, out)));
}

async function cover() {
  const plate = join(ILLUSTRATIONS, "chapter-03-european-manor-reference.webp");
  await sharp(plate)
    .linear(0.66, -14)
    .webp({ quality: 82 })
    .toFile(prepare(join(PUBLIC, "cover/plate.webp")));
  const landscape = { left: 0, top: 262, width: 1024, height: 640 };
  await sharp(plate)
    .extract(landscape)
    .linear(0.8, -10)
    .webp({ quality: 82 })
    .toFile(prepare(join(PUBLIC, "cover/card.webp")));
  await sharp(plate)
    .extract({ left: 0, top: 300, width: 1024, height: 538 })
    .resize(1200, 630)
    .linear(0.78, -8)
    .jpeg({ quality: 82 })
    .toFile(prepare(join(PUBLIC, "cover/og.jpg")));
}

for (const item of PORTRAITS) await portrait(item);
for (const item of POSTCARDS) await postcard(item);
await cover();
console.log(`wrote ${PORTRAITS.length} portraits, ${POSTCARDS.length} postcards and the cover set`);
