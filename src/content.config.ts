import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { SEA_ZONES } from "./data/sea/zones";

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

const seaChapters = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/the-sea-that-hung-above-the-world/chapters" }),
  schema: z.object({
    number: z.number().int().min(0).max(35),
    arc: z.number().int().min(1).max(7),
    title: z.string(),
    plate: z.object({
      place: z.string(),
      time: z.string().optional(),
      pov: z.array(z.string()),
    }),
    zone: z.enum(SEA_ZONES),
    zoneShifts: z
      .array(z.object({ scene: z.number().int().positive(), zone: z.enum(SEA_ZONES) }))
      .default([]),
    musicCueId: z.enum(["sun-sheet", "drowned-quarter", "pressure-veil", "old-pressure", "first-memory"]),
    readingMinutes: z.number().int().positive(),
    wordsThai: z.number().int().nonnegative(),
    arcEnd: z.boolean().default(false),
    draft: z.boolean().default(false),
    source: z.string(),
  }),
});


const kusabiChapters = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/kusabi/chapters" }),
  schema: z.object({
    number: z.number().int().min(0).max(12),
    title: z.string(),
    thaiTitle: z.string().optional(),
    act: z.number().int().min(1).max(3),
    actTitle: z.string(),
    summary: z.string().optional(),
    wordsThai: z.number().int().optional(),
    readingMinutes: z.number().int().optional(),
    musicCueId: z.enum(["rain-hills", "bells-fog", "audio-room", "bride-wedding", "go-home"]),
  }),
});

const kusabiExtras = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/kusabi/extras" }),
  schema: z.object({
    number: z.number().int().min(1).max(5),
    title: z.string(),
    slug: z.string(),
    summary: z.string().optional(),
    readingMinutes: z.number().int().optional(),
  }),
});

export const collections = { chapters, extras, tsukinomiSections, seaChapters, kusabiChapters, kusabiExtras };

