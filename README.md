# Atlas

Atlas is a hub of link directories. Each site in the hub is a separate directory with its own categories, accent color and tags. All sites share one theme and one search box, so you can search every link on every site from any page.

Live site: <https://testingplatoon.github.io/atlas/>

Built with [Astro](https://astro.build). The site is static and hosted free on GitHub Pages.

## Run it on your computer

You need Node.js 24 (see `.nvmrc`).

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:4321/atlas/>. The page reloads when you save a file.

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts a local server with live reload. |
| `npm run validate` | Checks every file in `data/` against the schemas. |
| `npm run check` | Runs the TypeScript and Astro type checks. |
| `npm run build` | Runs `validate`, then builds the site into `dist/`. |
| `npm run preview` | Serves the built `dist/` folder. |
| `npm run check-links` | Fetches every URL and reports dead links. |

## Folder structure

```text
atlas/
├── data/                         All content. You edit files here.
│   └── brawl-stars/              One folder per site. The folder name is the site id and URL.
│       ├── site.json             Site name, description, accent color, order, tag list.
│       ├── tools.json            Links in the "tools" category.
│       ├── tools.md              Title, card text and intro for the "tools" page.
│       └── ...                   One .json and one .md per category.
├── schema/
│   ├── links.schema.json         Rules for category files (the link fields).
│   └── site.schema.json          Rules for site.json.
├── scripts/
│   ├── validate.mjs              Checks data/ before every build.
│   └── check-links.mjs           Checks every URL. Never edits files.
├── src/
│   ├── config.ts                 Hub name, hub accent color, repo URL.
│   ├── content.config.ts         Loads the .md intros.
│   ├── lib/atlas.ts              Reads data/ and gives pages typed data.
│   ├── layouts/Base.astro        Header, category menu, footer, theme.
│   ├── components/               LinkList (with tag filter), Search, ThemeToggle.
│   ├── styles/global.css         Colors for light and dark, shared styles.
│   └── pages/                    One file per URL pattern (see below).
├── .github/workflows/            Deploy, pull request checks, weekly link check.
└── astro.config.mjs              Site URL and base path.
```

Pages and their URLs:

| File in `src/pages/` | URL | Shows |
| --- | --- | --- |
| `index.astro` | `/atlas/` | A card for each site. |
| `starred.astro` | `/atlas/starred/` | Starred links from all sites. |
| `[site]/index.astro` | `/atlas/brawl-stars/` | A card for each category. |
| `[site]/[category].astro` | `/atlas/brawl-stars/tools/` | The intro, then the links. |
| `[site]/starred.astro` | `/atlas/brawl-stars/starred/` | Starred links from one site. |
| `search-index.json.ts` | `/atlas/search-index.json` | The search index, made at build time. |

Square brackets in a file name mean "one page for each value". Astro makes one page for each site and each category in `data/`.

## Add a link

1. Open the category file, for example `data/brawl-stars/tools.json`.
2. Add an entry to the list:

   ```json
   {
     "title": "Site name",
     "url": "https://example.com/",
     "description": "One or two short sentences about what the site does.",
     "tags": ["stats", "meta"],
     "category": "tools",
     "starred": false,
     "added": "2026-10-29",
     "status": "unverified"
   }
   ```

3. Run `npm run validate`. Fix every problem that it lists.
4. Commit, then open a pull request. The pull request check runs the same validation.

Field rules:

| Field | Rule |
| --- | --- |
| `title` | Text, 1 to 100 characters. |
| `url` | Starts with `http://` or `https://`. Must be unique in the site. |
| `description` | Text, 1 to 300 characters. |
| `tags` | At least one. Each tag must be in the site's `site.json`. |
| `category` | Must be the same as the file name without `.json`. |
| `starred` | `true` or `false`. Starred links show a ★ and appear on the starred pages. |
| `added` | Date as `YYYY-MM-DD`. Not in the future. |
| `status` | `active` (shown), `unverified` (shown with a badge), or `dead` (kept in the file, hidden on the site). |

All 8 fields are required. The build fails if a field is missing, has the wrong type, or is not in this list.

The order of entries in the file is the order on the page.

VS Code shows these rules as you type, because `.vscode/settings.json` connects the data files to the schemas.

To add a tag, add `{ "id": "my-tag", "label": "My tag" }` to `tags` in the site's `site.json` first. Tag ids use lower-case letters, digits and hyphens.

## Add a category

1. Make two files with the same name in the site folder. The name becomes the URL. Use lower-case letters, digits and hyphens.
   - `data/brawl-stars/esports.json` with the content `[]`.
   - `data/brawl-stars/esports.md`:

     ```markdown
     ---
     title: Esports
     description: Tournaments, teams and match results.
     order: 6
     ---

     Intro text for the page. You can use any Markdown here.
     ```

2. `title` is the page heading and menu label. `description` is the text on the category card. `order` sets the position in the menu and on the site home page.
3. Run `npm run validate`.

The names `site` and `starred` are reserved and cannot be category names.

## Add a new site to the hub

1. Make a folder in `data/`, for example `data/clash-royale/`. The folder name is the site id and URL (`/atlas/clash-royale/`).
2. Add `data/clash-royale/site.json`:

   ```json
   {
     "$schema": "../../schema/site.schema.json",
     "name": "Clash Royale",
     "description": "Tools, decks and guides for Clash Royale.",
     "accent": "#3b82f6",
     "order": 2,
     "tags": [
       { "id": "decks", "label": "Decks" },
       { "id": "stats", "label": "Stats" }
     ]
   }
   ```

3. Add at least one category (a `.json` and a `.md` file, see above).
4. Run `npm run validate`, then `npm run dev`.

You do not need to change any code. The hub home page, the menus, the starred pages and the search pick up the new site automatically. `order` sets the position of the site card on the hub home page. `accent` is the site's color, as `#rrggbb`.

The names `starred` and `search-index` are reserved and cannot be site names.

## Check links

```bash
npm run check-links
```

The script fetches every URL and prints a Markdown report. It does not change any file. You decide what to update.

| Result | Meaning |
| --- | --- |
| Dead | HTTP 404 or 410, the domain does not exist, or the server refuses the connection. |
| Check manually | HTTP 401, 403, 429, other 4xx, 5xx, timeouts or TLS errors. Many sites block scripts (for example with Cloudflare), so a person must open these in a browser. |
| Status can change | The link loads, but its status is not `active`. |
| Redirected | The link works, but the address changed. You can update the URL. |

Options: `--site brawl-stars` checks one site. `--output report.md` also writes the report to a file. `--no-fail` exits with code 0 even if links are dead.

GitHub Actions runs the check every Monday. If a person must act, it opens an issue labeled `link-check`, or updates the open one.

## Deploy

`.github/workflows/deploy.yml` builds and publishes the site on every push to `main`. The workflow reads the base path from the GitHub Pages settings. If you add a custom domain later, you do not need to change code.

For local builds, `astro.config.mjs` uses `/atlas` as the default. To build for a different path, set `ATLAS_BASE` (for example `ATLAS_BASE= npm run build` for the root path).

## Secrets

This repository is public. Never commit API keys, tokens or passwords. `.gitignore` excludes `.env` and `.env.*` files. The site needs no secrets: the workflows use only the `GITHUB_TOKEN` that GitHub gives each run.
