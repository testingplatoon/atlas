// @ts-check
import { defineConfig } from 'astro/config';

// The deploy workflow sets these from the GitHub Pages settings.
// Locally they default to the GitHub Pages project URL.
const site = process.env.ATLAS_SITE || 'https://testingplatoon.github.io';
const base = process.env.ATLAS_BASE ?? '/atlas';

export default defineConfig({
  site,
  // An empty base (custom domain) means the site lives at the root.
  base: base || '/',
  trailingSlash: 'ignore',
});
