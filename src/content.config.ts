import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const chapters = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/lodge/chapters" }),
  schema: z.object({
    number: z.number().int().min(0).max(18),
    title: z.string(),
    thaiTitle: z.string().optional(),
    act: z.number().int().min(1).max(4),
    actTitle: z.string(),
    summary: z.string().optional(),
    wordsThai: z.number().int().optional(),
    readingMinutes: z.number().int().optional(),
  }),
});

const extras = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/lodge/extras" }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
  }),
});

const tsukinomiSections = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/tsukinomi/sections" }),
  schema: z.object({
    number: z.number().int().min(0).max(5),
    title: z.string(),
    englishTitle: z.string(),
    chapterRange: z.string(),
    summary: z.string(),
    readingMinutes: z.number().int().positive(),
    musicCueId: z.enum(["discovery", "reveal", "decision", "mountain", "ten-years"]),
    backgroundImage: z.string(),
    palette: z.enum(["autumn", "twilight", "warm-room", "snow-pact", "winter-light"]),
  }),
});

const seaArcs = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/the-sea-that-hung-above-the-world" }),
  schema: z.object({
    number: z.number().int().min(1).max(7),
    title: z.string(),
    englishTitle: z.string(),
    chapterRange: z.string(),
    summary: z.string(),
    readingMinutes: z.number().int().positive(),
    musicCueId: z.enum(["sun-sheet", "drowned-quarter", "pressure-veil", "old-pressure", "first-memory"]),
    backgroundImage: z.string().optional(),
    depthLayer: z.number().int().min(1).max(5),
  }),
});

export const collections = { chapters, extras, tsukinomiSections, seaArcs };

