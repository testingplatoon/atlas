// Checks every file in data/ before the build.
// Exits with code 1 and lists every problem if one file is wrong.
//
// Usage: npm run validate

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = new URL('..', import.meta.url).pathname;
const dataDir = join(root, 'data');

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// These names are used by fixed routes, so a site or category cannot use them.
const RESERVED_SITES = ['starred', 'search-index'];
const RESERVED_CATEGORIES = ['site', 'starred'];

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
const validateLinks = ajv.compile(readJson(join(root, 'schema/links.schema.json')));
const validateSite = ajv.compile(readJson(join(root, 'schema/site.schema.json')));

const errors = [];
const error = (file, message) => errors.push(`${relative(root, file)}: ${message}`);
const today = new Date().toISOString().slice(0, 10);
let linkCount = 0;

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function tryReadJson(file) {
  try {
    return readJson(file);
  } catch (e) {
    error(file, `not valid JSON (${e.message})`);
    return undefined;
  }
}

// Turns an Ajv error into a readable message, with the link title if there is one.
function describe(err, data) {
  const index = err.instancePath.match(/^\/(\d+)/)?.[1];
  const where = index === undefined ? '' : `entry ${index} ("${data[index]?.title ?? 'no title'}")`;
  const field = err.instancePath.replace(/^\/\d+/, '').replace(/^\//, '') || '';
  let message = err.message;
  if (err.keyword === 'additionalProperties') message = `unknown field "${err.params.additionalProperty}"`;
  if (err.keyword === 'enum') message = `must be one of: ${err.params.allowedValues.join(', ')}`;
  return [where, field && `field "${field}"`, message].filter(Boolean).join(', ');
}

// Lower-case host and no trailing slash, so near-duplicate URLs match.
function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch {
    return url;
  }
}

const sites = readdirSync(dataDir).filter((name) => statSync(join(dataDir, name)).isDirectory());
if (sites.length === 0) errors.push('data/: no site folders found');

for (const siteId of sites) {
  const siteDir = join(dataDir, siteId);
  const siteFile = join(siteDir, 'site.json');

  if (!SLUG.test(siteId)) error(siteDir, 'folder name must be lower-case letters, digits and hyphens');
  if (RESERVED_SITES.includes(siteId)) error(siteDir, `"${siteId}" is a reserved name`);

  if (!existsSync(siteFile)) {
    error(siteFile, 'missing. Every site folder needs a site.json');
    continue;
  }
  const site = tryReadJson(siteFile);
  if (site === undefined) continue;
  if (!validateSite(site)) {
    for (const err of validateSite.errors) error(siteFile, `${err.instancePath || '/'} ${err.message}`);
    continue;
  }

  const tagIds = new Set();
  for (const tag of site.tags) {
    if (tagIds.has(tag.id)) error(siteFile, `tag "${tag.id}" is listed twice`);
    tagIds.add(tag.id);
  }

  const files = readdirSync(siteDir);
  const jsonFiles = files.filter((f) => f.endsWith('.json') && f !== 'site.json');
  const mdFiles = files.filter((f) => f.endsWith('.md'));
  const seenUrls = new Map();

  for (const md of mdFiles) {
    if (!jsonFiles.includes(md.replace(/\.md$/, '.json'))) {
      error(join(siteDir, md), `has no matching ${md.replace(/\.md$/, '.json')}`);
    }
  }

  for (const jsonName of jsonFiles) {
    const file = join(siteDir, jsonName);
    const categoryId = jsonName.replace(/\.json$/, '');

    if (!SLUG.test(categoryId)) error(file, 'file name must be lower-case letters, digits and hyphens');
    if (RESERVED_CATEGORIES.includes(categoryId)) error(file, `"${categoryId}" is a reserved name`);
    if (!mdFiles.includes(`${categoryId}.md`)) error(file, `has no matching ${categoryId}.md intro`);

    const links = tryReadJson(file);
    if (links === undefined) continue;
    if (!validateLinks(links)) {
      for (const err of validateLinks.errors) error(file, describe(err, links));
      continue;
    }

    links.forEach((link, i) => {
      const where = `entry ${i} ("${link.title}")`;
      linkCount++;
      if (link.category !== categoryId) {
        error(file, `${where}, field "category" is "${link.category}" but the file is ${jsonName}`);
      }
      for (const tag of link.tags) {
        if (!tagIds.has(tag)) error(file, `${where}, tag "${tag}" is not in ${siteId}/site.json`);
      }
      if (link.added > today) error(file, `${where}, field "added" (${link.added}) is in the future`);

      const key = normalizeUrl(link.url);
      if (seenUrls.has(key)) error(file, `${where}, URL is already in ${seenUrls.get(key)}`);
      else seenUrls.set(key, `${jsonName} entry ${i}`);
    });
  }
}

if (errors.length > 0) {
  console.error(`Data validation failed with ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error('');
  process.exit(1);
}

console.log(`Data is valid: ${sites.length} site(s), ${linkCount} link(s).`);
