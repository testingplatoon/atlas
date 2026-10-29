import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Category intros: data/<site>/<category>.md
// The entry id is "<site>/<category>", taken from the file path.
const intros = defineCollection({
  loader: glob({
    pattern: '*/*.md',
    base: './data',
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    order: z.number().int().min(0),
  }),
});

export const collections = { intros };
