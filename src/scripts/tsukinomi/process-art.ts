// Prepares the art of the character page and the Extra train from the source sheets,
// so the pages never ship a sheet's ruler, labels or white paper.
//
//   pnpm tsukinomi:art
//
// A sheet's front view and its row of expressions are found by the ink in its
// columns; the paper is removed by flooding inward from the edges, so a white
// shirt survives; the largest shape is kept, which drops rulers and captions.
// Output: public/assets/tsukinomi/images/platform/ and images/train/. Names are
// neutral, so a file name tells nothing of who opens later.
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const IMAGES = "public/assets/tsukinomi/images";
const PLATFORM = join(IMAGES, "platform");
const TRAIN = join(IMAGES, "train");

interface Sheet {
  out: string;
  file: string;
  /** Points on the cut-out, relative to it, of paper enclosed by the figure (the gap inside a bent arm). */
  holes?: Array<[number, number]>;
  /** How many expressions to cut from the row under the figures. */
  faces?: boolean;
}

const SHEETS: Sheet[] = [
  { out: "f01", file: "characters/Takahashi Haruto.webp", faces: true },
  { out: "f02", file: "characters/Naomi.webp", faces: true },
  { out: "f03", file: "characters/Hina.webp", faces: true },
  { out: "f04", file: "characters/Suzuki Akira.webp", faces: true },
  { out: "f05", file: "characters/Tanaka Akihiro.webp", faces: true },
  { out: "f06", file: "characters/Mizushima Kaori.webp", faces: true },
  { out: "f07", file: "characters/Yamaba-baa.webp" },
  { out: "f08", file: "characters/Watanabe.webp", faces: true },
  // Ten years on: Haruto, Hina and Akira as adults.
  { out: "l01", file: "extra/haruto-adult-reunion-175cm-draft.png" },
  { out: "l03", file: "extra/hina-adult-reunion-162cm-draft.png" },
  { out: "l04", file: "extra/suzuki-akira-university-180cm-draft.png" },
];

/** The Extra train's pictures, in riding order. */
const WINDOWS: Array<[string, string]> = [
  ["t1", "extra/kaori-hina-child-jump-hug-v3.png"],
  ["t2", "extra/kaori-hina-adult-hands-reunion-v1.png"],
  ["t5", "extra/naomi-dry-goods-shop-v1.png"],
  ["t6", "extra/naomi-akihiro-shop-talk-v1.png"],
  ["t7", "extra/akira-otaku-room-2008-v1.png"],
  ["t8", "extra/watanabe-tea-engawa-v1.png"],
  ["t3", "extra/akira-haruto-future-izakaya-dinner-v1.png"],
  ["t4", "extra/thank-you-haruto-hina-kaori.webp"],
];

const PAPER_LEVEL = 232;
const INK_LEVEL = 170;
const MIN_RUN = 70;
/** The half body: from the crown to about the hips, in a frame centred on the head. */
const HALF_SHARE = 0.5;
const HALF_RATIO = 0.72;
const HALF_HEADROOM = 0.035;

interface Gray {
  data: Buffer;
  width: number;
  height: number;
}

async function readGray(path: string): Promise<Gray> {
  const { data, info } = await sharp(path).flatten({ background: "#ffffff" }).grayscale().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Runs of columns with ink between two rows, wider than a ruler or a caption. */
function inkRuns(sheet: Gray, top: number, bottom: number): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  let start = -1;
  for (let x = 0; x <= sheet.width; x++) {
    let ink = 0;
    if (x < sheet.width) {
      for (let y = top; y < bottom; y++) if (sheet.data[y * sheet.width + x] < INK_LEVEL) ink++;
    }
    const inked = ink > 1;
    if (inked && start < 0) start = x;
    if (!inked && start >= 0) {
      if (x - start > MIN_RUN) runs.push([start, x]);
      start = -1;
    }
  }
  return runs;
}

/** The emptiest band between the full bodies and the expressions. */
function findSplit(sheet: Gray): number {
  const { data, width, height } = sheet;
  const rowInk = (y: number) => {
    let ink = 0;
    for (let x = Math.floor(width * 0.14); x < width; x++) if (data[y * width + x] < 150) ink++;
    return ink;
  };
  let split = Math.floor(height * 0.72);
  let best = Number.POSITIVE_INFINITY;
  for (let y = Math.floor(height * 0.55); y < height * 0.85; y++) {
    let sum = 0;
    for (let k = -4; k <= 4; k++) sum += rowInk(y + k);
    if (sum < best) {
      best = sum;
      split = y;
    }
  }
  return split;
}

interface Region {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Cuts a region out of its paper and keeps the largest shape, trimmed to that shape. */
async function cutOut(path: string, region: Region, holes: Array<[number, number]> = []): Promise<{ png: Buffer; width: number; height: number }> {
  const { left, top, width: W, height: H } = region;
  const rgba = Buffer.from(
    await sharp(path).flatten({ background: "#ffffff" }).extract({ left, top, width: W, height: H }).ensureAlpha().raw().toBuffer(),
  );
  const lum = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return 0.3 * rgba[i] + 0.59 * rgba[i + 1] + 0.11 * rgba[i + 2];
  };
  const paper = new Uint8Array(W * H);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const k = y * W + x;
    if (paper[k] || lum(x, y) < PAPER_LEVEL) return;
    paper[k] = 1;
    stack.push(k);
  };
  for (let x = 0; x < W; x++) {
    push(x, 0);
    push(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    push(0, y);
    push(W - 1, y);
  }
  for (const [x, y] of holes) push(x, y);
  while (stack.length) {
    const k = stack.pop() as number;
    const x = k % W;
    const y = (k - x) / W;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  // The largest shape that is not paper.
  const label = new Int32Array(W * H).fill(-1);
  let best = -1;
  let bestSize = 0;
  let next = 0;
  for (let s = 0; s < W * H; s++) {
    if (label[s] !== -1 || paper[s]) continue;
    const id = next++;
    const shape = [s];
    label[s] = id;
    let size = 0;
    while (shape.length) {
      const k = shape.pop() as number;
      size++;
      const x = k % W;
      const y = (k - x) / W;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const n = ny * W + nx;
          if (label[n] === -1 && !paper[n]) {
            label[n] = id;
            shape.push(n);
          }
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = id;
    }
  }

  let x0 = W;
  let x1 = 0;
  let y0 = H;
  let y1 = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      const i = k * 4;
      if (label[k] !== best) {
        rgba[i + 3] = 0;
        continue;
      }
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      // A soft edge where the shape meets the paper, so the outline does not look cut with scissors.
      const edge = (x > 0 && paper[k - 1]) || (x < W - 1 && paper[k + 1]) || (y > 0 && paper[k - W]) || (y < H - 1 && paper[k + W]);
      if (edge) rgba[i + 3] = Math.min(255, Math.round(255 - lum(x, y) * 0.75));
    }
  }
  const width = x1 - x0 + 1;
  const height = y1 - y0 + 1;
  const png = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).extract({ left: x0, top: y0, width, height }).png().toBuffer();
  return { png, width, height };
}

async function writeWebp(input: Buffer, out: string): Promise<void> {
  await sharp(input).webp({ quality: 86, alphaQuality: 90 }).toFile(join(PLATFORM, `${out}.webp`));
}

async function half(figure: { png: Buffer; width: number; height: number }, out: string): Promise<void> {
  const { data, info } = await sharp(figure.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const headRows = Math.floor(info.height * 0.1);
  let sum = 0;
  let count = 0;
  for (let y = 0; y < headRows; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 40) {
        sum += x;
        count++;
      }
    }
  }
  const centre = count ? sum / count : info.width / 2;
  const height = Math.round(info.height * HALF_SHARE);
  const width = Math.round(height * HALF_RATIO);
  const left = Math.round(centre - width / 2);
  const cropLeft = Math.max(0, left);
  const cropWidth = Math.min(info.width - cropLeft, width - (cropLeft - left));
  const cropped = await sharp(figure.png)
    .extract({ left: cropLeft, top: 0, width: cropWidth, height })
    .extend({
      left: cropLeft - left,
      right: width - cropWidth - (cropLeft - left),
      top: Math.round(height * HALF_HEADROOM),
      bottom: 0,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  await writeWebp(cropped, out);
}

async function processSheet(sheet: Sheet): Promise<void> {
  const path = join(IMAGES, sheet.file);
  const gray = await readGray(path);
  const split = findSplit(gray);
  const runs = inkRuns(gray, Math.floor(gray.height * 0.09), split);
  if (runs.length === 0) throw new Error(`${sheet.file}: no figure found`);
  const [start, end] = runs[0];
  const left = Math.max(0, start - 6);
  const region: Region = {
    left,
    top: Math.floor(gray.height * 0.03),
    width: Math.min(gray.width - left, end - start + 12),
    height: split - Math.floor(gray.height * 0.03),
  };
  const figure = await cutOut(path, region, sheet.holes);
  await half(figure, sheet.out);

  if (sheet.faces) {
    const top = split;
    const runsBelow = inkRuns(gray, top, gray.height - 2);
    if (runsBelow.length !== 3) throw new Error(`${sheet.file}: expected 3 expressions, found ${runsBelow.length}`);
    for (const [index, [a, b]] of runsBelow.entries()) {
      const face = await cutOut(path, { left: Math.max(0, a - 4), top, width: Math.min(gray.width - Math.max(0, a - 4), b - a + 8), height: gray.height - top });
      await writeWebp(face.png, `${sheet.out}-face-${index + 1}`);
    }
  }
  console.log(`${sheet.out}: figure ${figure.width}x${figure.height}`);
}

// This folder holds nothing but this script's output: start clean so no old name stays public.
rmSync(PLATFORM, { recursive: true, force: true });
mkdirSync(PLATFORM, { recursive: true });
mkdirSync(TRAIN, { recursive: true });
for (const sheet of SHEETS) await processSheet(sheet);
for (const [out, file] of WINDOWS) {
  const info = await sharp(join(IMAGES, file)).resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toFile(join(TRAIN, `${out}.webp`));
  console.log(`${out}: ${info.width}x${info.height} ${Math.round(info.size / 1024)} KB`);
}
