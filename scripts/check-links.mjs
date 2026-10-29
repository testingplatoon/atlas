// Checks every URL in data/ and writes a Markdown report.
// It never changes the data files. You decide what to update.
//
// Usage:
//   npm run check-links                          all sites, report to the terminal
//   npm run check-links -- --site brawl-stars    one site
//   npm run check-links -- --output report.md    also write the report to a file
//   npm run check-links -- --no-fail             exit 0 even if links are dead
//
// Results:
//   ok      the page loaded (2xx, after redirects)
//   dead    404 or 410, or the domain does not exist / refuses connections
//   manual  401, 403, 429, other 4xx, 5xx, timeouts and TLS errors.
//           Many sites block scripts (for example Cloudflare), so a person must check these.

import { readdirSync, readFileSync, writeFileSync, appendFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dataDir = join(root, 'data');

const TIMEOUT_MS = 20_000;
const CONCURRENCY = 6;
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const onlySite = option('--site');
const outputFile = option('--output');
const noFail = args.includes('--no-fail');

// Collect every link with the file it came from.
const links = [];
for (const site of readdirSync(dataDir)) {
  const siteDir = join(dataDir, site);
  if (!statSync(siteDir).isDirectory() || (onlySite && site !== onlySite)) continue;
  for (const file of readdirSync(siteDir)) {
    if (!file.endsWith('.json') || file === 'site.json') continue;
    const path = join(siteDir, file);
    const entries = JSON.parse(readFileSync(path, 'utf8'));
    entries.forEach((link, index) => links.push({ ...link, file: relative(root, path), index }));
  }
}

async function request(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      'Accept-Language': 'en',
    },
  });
  // Only the status matters, so do not download the body.
  await res.body?.cancel().catch(() => {});
  return res;
}

function classifyStatus(status) {
  if (status >= 200 && status < 300) return ['ok', `HTTP ${status}`];
  if (status === 404 || status === 410) return ['dead', `HTTP ${status}`];
  if (status === 401 || status === 403) return ['manual', `HTTP ${status} (access denied, often bot blocking)`];
  if (status === 429) return ['manual', 'HTTP 429 (rate limited)'];
  if (status >= 500) return ['manual', `HTTP ${status} (server error, may be temporary)`];
  return ['manual', `HTTP ${status}`];
}

function classifyError(err) {
  if (err.name === 'TimeoutError' || err.name === 'AbortError') {
    return ['manual', `no answer in ${TIMEOUT_MS / 1000} s`];
  }
  const code = String(err.cause?.code ?? err.code ?? '');
  const detail = err.cause?.message ?? err.message;
  if (code === 'ENOTFOUND') return ['dead', 'domain not found'];
  if (code === 'ECONNREFUSED') return ['dead', 'connection refused'];
  if (code.includes('CERT') || code.includes('TLS') || code.includes('SSL')) {
    return ['manual', `TLS problem (${code})`];
  }
  return ['manual', `network error (${detail})`];
}

const sameUrl = (a, b) => a.replace(/\/+$/, '') === b.replace(/\/+$/, '');

async function check(link) {
  let lastError;
  // Network errors get one retry, because they are often temporary.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await request(link.url);
      const [result, reason] = classifyStatus(res.status);
      const redirect = res.redirected && !sameUrl(res.url, link.url) ? res.url : undefined;
      return { ...link, result, reason, redirect };
    } catch (err) {
      lastError = err;
    }
  }
  const [result, reason] = classifyError(lastError);
  return { ...link, result, reason };
}

// Run CONCURRENCY checks at a time.
const results = [];
let next = 0;
async function worker() {
  while (next < links.length) {
    const link = links[next++];
    const r = await check(link);
    results.push(r);
    process.stderr.write(`${r.result.padEnd(6)} ${r.url}\n`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
results.sort((a, b) => a.file.localeCompare(b.file) || a.index - b.index);

// A link already marked dead that is still dead is not news.
const dead = results.filter((r) => r.result === 'dead' && r.status !== 'dead');
const manual = results.filter((r) => r.result === 'manual');
const redirected = results.filter((r) => r.result === 'ok' && r.redirect);
const suggestions = results.filter((r) => r.result === 'ok' && r.status !== 'active');
const ok = results.filter((r) => r.result === 'ok');

const cell = (text) => String(text).replace(/\|/g, '\\|');
const row = (r, extra) => `| ${cell(r.title)} | ${cell(r.url)} | \`${r.file}\` #${r.index} | ${cell(extra)} |`;
const table = (heading, note, rows, extraHeading, extra) =>
  rows.length === 0
    ? []
    : [
        `## ${heading} (${rows.length})`,
        '',
        note,
        '',
        `| Title | URL | Entry | ${extraHeading} |`,
        '| --- | --- | --- | --- |',
        ...rows.map((r) => row(r, extra(r))),
        '',
      ];

const date = new Date().toISOString().slice(0, 10);
const report = [
  '# Link check report',
  '',
  `Checked ${results.length} links on ${date}${onlySite ? ` (site: ${onlySite})` : ''}: ` +
    `${ok.length} ok, ${dead.length} dead, ${manual.length} to check manually, ${redirected.length} redirected.`,
  '',
  ...table('Dead', 'Set `"status": "dead"` on these if you confirm they are gone.', dead, 'Result', (r) => r.reason),
  ...table(
    'Check manually',
    'The script could not confirm these. Open each one in a browser.',
    manual,
    'Result',
    (r) => r.reason,
  ),
  ...table(
    'Status can change',
    'These loaded, but their status is not `active`.',
    suggestions,
    'Current status',
    (r) => r.status,
  ),
  ...table('Redirected', 'These still work. You can update the URL to the new address.', redirected, 'Now at', (r) => r.redirect),
].join('\n');

console.log(report);
if (outputFile) writeFileSync(outputFile, report + '\n');

// In GitHub Actions, tell the workflow how many findings need a person.
const findings = dead.length + manual.length + suggestions.length;
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `findings=${findings}\n`);

if (dead.length > 0 && !noFail) process.exit(1);
