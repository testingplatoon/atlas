// Builds /search-index.json from the link data at build time.
// The search box loads this file the first time someone uses it.
import type { APIRoute } from 'astro';
import { getCategories, href, tagLabels, type SearchDoc } from '../lib/atlas';

export const GET: APIRoute = async () => {
  const docs: SearchDoc[] = [];
  for (const category of await getCategories()) {
    const labels = tagLabels(category.site);
    for (const link of category.links) {
      docs.push({
        id: docs.length,
        title: link.title,
        url: link.url,
        description: link.description,
        tags: link.tags.map((t) => labels.get(t) ?? t).join(' '),
        starred: link.starred,
        unverified: link.status === 'unverified',
        site: category.site.name,
        category: category.title,
        categoryHref: href(`${category.site.id}/${category.id}/`),
      });
    }
  }
  return new Response(JSON.stringify(docs), {
    headers: { 'Content-Type': 'application/json' },
  });
};
