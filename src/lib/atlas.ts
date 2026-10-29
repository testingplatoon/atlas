// Reads the data/ folder at build time and gives pages typed data.
// scripts/validate.mjs has already checked every file before this runs.
import { getCollection, type CollectionEntry } from 'astro:content';

export type Status = 'active' | 'dead' | 'unverified';

export interface Link {
  title: string;
  url: string;
  description: string;
  tags: string[];
  category: string;
  starred: boolean;
  added: string;
  status: Status;
}

export interface Tag {
  id: string;
  label: string;
}

export interface Site {
  id: string;
  name: string;
  description: string;
  accent: string;
  order: number;
  tags: Tag[];
}

export interface Category {
  id: string;
  site: Site;
  title: string;
  description: string;
  order: number;
  intro: CollectionEntry<'intros'>;
  /** Links shown on the site. Dead links are left out. */
  links: Link[];
}

/** One link in search-index.json. */
export interface SearchDoc {
  id: number;
  title: string;
  url: string;
  description: string;
  /** Tag labels, joined with spaces so they can be searched as text. */
  tags: string;
  starred: boolean;
  unverified: boolean;
  site: string;
  category: string;
  categoryHref: string;
}

const siteFiles = import.meta.glob<Omit<Site, 'id'>>('/data/*/site.json', {
  eager: true,
  import: 'default',
});
const linkFiles = import.meta.glob<Link[]>(['/data/*/*.json', '!/data/*/site.json'], {
  eager: true,
  import: 'default',
});

/** "/data/brawl-stars/tools.json" -> ["brawl-stars", "tools"] */
function parts(path: string): [string, string] {
  const [, , site, file] = path.split('/');
  return [site, file.replace(/\.json$/, '')];
}

export function isVisible(link: Link): boolean {
  return link.status !== 'dead';
}

export function getSites(): Site[] {
  return Object.entries(siteFiles)
    .map(([path, data]) => ({ ...data, id: parts(path)[0] }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function getSite(id: string): Site {
  const site = getSites().find((s) => s.id === id);
  if (!site) throw new Error(`Unknown site "${id}"`);
  return site;
}

export async function getCategories(siteId?: string): Promise<Category[]> {
  const sites = new Map(getSites().map((s) => [s.id, s]));
  const intros = await getCollection('intros');
  return intros
    .map((intro) => {
      const [site, id] = intro.id.split('/');
      const links = linkFiles[`/data/${site}/${id}.json`] ?? [];
      return {
        id,
        site: sites.get(site)!,
        title: intro.data.title,
        description: intro.data.description,
        order: intro.data.order,
        intro,
        links: links.filter(isVisible),
      };
    })
    .filter((c) => c.site && (!siteId || c.site.id === siteId))
    .sort((a, b) => a.site.order - b.site.order || a.order - b.order || a.title.localeCompare(b.title));
}

/** Tag labels for a site, by id. */
export function tagLabels(site: Site): Map<string, string> {
  return new Map(site.tags.map((t) => [t.id, t.label]));
}

/** Joins a path to the configured base path, e.g. "brawl-stars/" -> "/atlas/brawl-stars/". */
export function href(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}
