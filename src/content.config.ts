import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const chapters = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/lodge/chapters" }),
  schema: z.object({
    number: z.number().int().min(1).max(18),
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

export const collections = { chapters, extras };
