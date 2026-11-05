// Builds every Kusabi website image that is not a chapter illustration from the
// untouched sources in public/assets/kusabi/images/characters/ and extra/moments/. Those
// folders never reach the build (astro.config.mjs). Output names are neutral on purpose:
// a locked picture must not say who it shows.
//
//   pnpm exec tsx src/scripts/kusabi/process-art.ts
//
// Crop boxes are source pixels read off the sheets. Re-running overwrites the
// output and never changes a source file.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
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

/**
 * Character file portraits. f01 to f05 are public, the rest load only after their unlock.
 * Framing follows f01, the author's reference: the head centred and about 70-75% of the
 * frame's height, a little space above it, and the neck and shoulders below.
 */
const PORTRAITS: Portrait[] = [
  { out: "files/f01.webp", source: `${SHEETS}/arai-ryoya-draft-v2.png`, box: box(500, 680, 320, 400) },
  { out: "files/f02.webp", source: `${SHEETS}/nao-amamiya-draft-v2.png`, box: box(989, 490, 272, 340) },
  { out: "files/f03.webp", source: `${SHEETS}/kaito-sakuraba-draft-v2.webp`, box: box(1004, 50, 264, 330) },
  { out: "files/f04.webp", source: `${SHEETS}/misaki-kurosawa-draft-v2.png`, box: box(20, 860, 290, 362) },
  { out: "files/f05.webp", source: `${SHEETS}/risa-asahina-draft-v2.png`, box: box(1186, 0, 266, 332) },
  { out: "files/f06.webp", source: `${SHEETS}/shion-madoka-caretaker-draft-v2.png`, box: box(955, 68, 270, 338) },
  { out: "files/f07.webp", source: `${SHEETS}/shion-madoka-killer-draft-v2.png`, box: box(1224, 18, 308, 385) },
  { out: "files/f08.webp", source: `${SHEETS}/shion-madoka-killer-unmasked-draft-v2.png`, box: box(1030, 5, 420, 525) },
  { out: "files/f09.webp", source: `${SHEETS}/ayame-hirasaka-draft-v2.png`, box: box(1043, 6, 384, 480) },
  { out: "files/f10.webp", source: `${SHEETS}/ryokan-owner-draft-v2.webp`, box: box(1222, 88, 300, 375) },
];

const PORTRAIT_WIDTH = 480;
const PORTRAIT_HEIGHT = 600;

const MOMENT_SOURCES = "extra/moments";
const MOMENT_WIDTH = 1280;

/** Pictures in no chapter, in the order of src/data/kusabi/moments.ts. */
const MOMENT_PICTURES = [
  "cast-03-nao-clip-final",
  "cast-01-table-photo",
  "cast-04-kaito-mist",
  "cast-02-five-pairs",
  "moment-01-five-minutes",
  "moment-02-turn-away-cheek-poke",
  "moment-03-the-tape",
  "moment-04-onion-feeding-user-approved",
  "thank-you-sunday-final",
];

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
  const base = await sharp(join(PUBLIC, source))
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

async function moment(source: string, index: number) {
  const out = `gallery/m${String(index + 1).padStart(2, "0")}.webp`;
  await sharp(join(PUBLIC, MOMENT_SOURCES, `${source}.webp`))
    .resize({ width: MOMENT_WIDTH, withoutEnlargement: true, kernel: "lanczos3" })
    .webp({ quality: 82 })
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
await Promise.all(MOMENT_PICTURES.map(moment));
await cover();
console.log(`wrote ${PORTRAITS.length} portraits, ${MOMENT_PICTURES.length} gallery pictures and the cover set`);
