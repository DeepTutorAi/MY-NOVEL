import { defineCollection } from "astro:content";

const chapters = defineCollection({
  loader: async () => [],
});

const extras = defineCollection({
  loader: async () => [],
});

export const collections = { chapters, extras };
