/**
 * SEO validator — `npm run seo:check`.
 *
 * seo.data.json is edited by hand and drives titles, descriptions, the sitemap,
 * robots.txt and every prerendered file. A typo there is invisible in the app
 * and only shows up weeks later as a ranking problem, so it gets a linter.
 *
 * ERRORS fail the build. They are the mistakes that actively cost traffic:
 * missing or duplicate titles, internal links to unregistered routes, a route in
 * the sitemap that is not prerendered, a noindex page in the sitemap.
 *
 * WARNINGS do not fail. They are judgement calls — mostly snippet lengths, where
 * Google truncates rather than penalises.
 *
 * The dist/ checks are skipped when dist/ is absent, so this is useful both
 * before and after a build.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const DATA = join(ROOT, 'src', 'seo', 'seo.data.json');

// Google truncates the title around 60 characters and the description around
// 160. Past those it is cosmetic; well past them it is a real problem.
const TITLE_WARN = 60;
const TITLE_FAIL = 75;
const DESC_MIN = 70;
const DESC_WARN = 160;
const DESC_FAIL = 200;

const errors = [];
const warnings = [];
const fail = (where, msg) => errors.push({ where, msg });
const warn = (where, msg) => warnings.push({ where, msg });

const canonicalPath = (p) => {
  const clean = p.split('?')[0].split('#')[0];
  const prefixed = clean.startsWith('/') ? clean : `/${clean}`;
  return prefixed.length > 1 && prefixed.endsWith('/')
    ? prefixed.slice(0, -1)
    : prefixed;
};

const buildTitle = (site, title, useDefaultTitle) => {
  if (!title) return site.defaultTitle;
  if (useDefaultTitle || title === site.defaultTitle) return title;
  if (title.includes(site.name)) return title;
  return site.titleTemplate.replace('%s', title);
};

/* ------------------------------------------------------------------- data */

const { site, routes, faq, howTo } = JSON.parse(readFileSync(DATA, 'utf8'));

for (const field of [
  'name',
  'url',
  'lang',
  'titleTemplate',
  'defaultTitle',
  'defaultDescription',
  'defaultImage',
]) {
  if (!site[field]) fail('site', `missing required field "${field}"`);
}

if (site.url?.endsWith('/')) {
  fail('site', `url must not end in a slash (got "${site.url}") — every canonical would double up`);
}

const known = new Set(routes.map((r) => canonicalPath(r.path)));
const seenPaths = new Set();
const titles = new Map();
const descriptions = new Map();

for (const route of routes) {
  const where = route.path ?? '(route with no path)';

  if (!route.path) {
    fail(where, 'route has no "path"');
    continue;
  }
  if (seenPaths.has(route.path)) fail(where, 'duplicate route path');
  seenPaths.add(route.path);

  if (typeof route.index !== 'boolean') {
    fail(where, '"index" must be explicitly true or false');
  }
  if (!route.title) fail(where, 'missing "title"');
  if (!route.description) fail(where, 'missing "description"');

  const title = buildTitle(site, route.title, route.useDefaultTitle);
  const desc = route.description ?? '';

  // Length and uniqueness only matter for pages that can appear in results.
  if (route.index) {
    if (title.length > TITLE_FAIL) {
      fail(where, `title is ${title.length} chars (hard limit ${TITLE_FAIL}): "${title}"`);
    } else if (title.length > TITLE_WARN) {
      warn(where, `title is ${title.length} chars — Google truncates around ${TITLE_WARN}`);
    }

    if (desc.length > DESC_FAIL) {
      fail(where, `description is ${desc.length} chars (hard limit ${DESC_FAIL})`);
    } else if (desc.length > DESC_WARN) {
      warn(where, `description is ${desc.length} chars — Google truncates around ${DESC_WARN}`);
    } else if (desc.length && desc.length < DESC_MIN) {
      warn(where, `description is only ${desc.length} chars — too thin to earn a click`);
    }

    if (titles.has(title)) {
      fail(where, `duplicate title, also used by ${titles.get(title)}`);
    } else {
      titles.set(title, route.path);
    }

    if (descriptions.has(desc)) {
      fail(where, `duplicate description, also used by ${descriptions.get(desc)}`);
    } else {
      descriptions.set(desc, route.path);
    }

    if (!route.path.includes(':')) {
      if (typeof route.priority !== 'number') warn(where, 'indexable route has no sitemap "priority"');
      if (!route.changefreq) warn(where, 'indexable route has no sitemap "changefreq"');
      if (!route.content) {
        warn(where, 'indexable route has no "content" block — its prerendered <noscript> will be a bare title');
      }
    }

    if (route.path.includes(':')) {
      fail(where, 'a parameterised route cannot be indexable — it has no single canonical URL');
    }
  }

  // Internal links must resolve. This is the check that catches a link added to
  // a page before the route it points at exists.
  for (const link of route.content?.links ?? []) {
    if (/^https?:\/\//i.test(link.href)) continue;
    if (!known.has(canonicalPath(link.href))) {
      fail(where, `content link points at "${link.href}", which is not a registered route`);
    }
  }

  if (route.content && !route.content.h1) fail(where, 'content block has no "h1"');
  if (route.content && !route.content.lead) fail(where, 'content block has no "lead"');
}

if (!routes.some((r) => canonicalPath(r.path) === '/')) {
  fail('routes', 'no entry for "/" — the homepage would fall back to the SPA shell');
}

/* FAQ and HowTo back rich results, so empty ones are worse than none. */
if (!Array.isArray(faq) || faq.length < 2) {
  warn('faq', 'fewer than 2 FAQ entries — not worth the FAQPage markup');
}
for (const [i, item] of (faq ?? []).entries()) {
  if (!item.question || !item.answer) fail(`faq[${i}]`, 'needs both "question" and "answer"');
}
if (!howTo?.steps?.length) warn('howTo', 'no steps defined');

/* ------------------------------------------------------------------- dist */

let distChecked = false;

if (existsSync(join(DIST, 'index.html'))) {
  distChecked = true;

  const indexable = routes.filter((r) => r.index && !r.path.includes(':'));

  for (const route of indexable) {
    const path = canonicalPath(route.path);
    const file = path === '/' ? join(DIST, 'index.html') : join(DIST, path, 'index.html');
    if (!existsSync(file)) {
      fail(path, 'indexable route was not prerendered — run `npm run seo`');
      continue;
    }

    const html = readFileSync(file, 'utf8');

    if (!/rel="canonical"/.test(html)) fail(path, 'prerendered file has no canonical');
    if (/name="robots" content="noindex/.test(html)) {
      fail(path, 'prerendered file says noindex but the route is marked indexable');
    }

    const ld = html.match(/application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
    if (!ld) {
      fail(path, 'prerendered file has no JSON-LD');
    } else {
      try {
        const parsed = JSON.parse(ld[1].replace(/\\u003c/g, '<'));
        const nodes = parsed['@graph'] ?? [parsed];
        for (const node of nodes) {
          if (!node['@type']) fail(path, 'a JSON-LD node has no @type');
        }
      } catch (e) {
        fail(path, `JSON-LD does not parse: ${e.message}`);
      }
    }
  }

  // The SPA fallback shell must never be indexable — it answers every unknown
  // URL, so an indexable shell means every 404 is a homepage duplicate.
  const shellFile = join(DIST, 'app.html');
  if (!existsSync(shellFile)) {
    fail('dist/app.html', 'SPA fallback shell is missing — vercel.json rewrites to it');
  } else {
    const shell = readFileSync(shellFile, 'utf8');
    if (!/name="robots" content="noindex/.test(shell)) {
      fail('dist/app.html', 'SPA fallback shell must be noindex');
    }
    if (/rel="canonical"/.test(shell)) {
      fail('dist/app.html', 'SPA fallback shell must not carry a canonical — it answers unknown URLs');
    }
  }

  const sitemapFile = join(DIST, 'sitemap.xml');
  if (!existsSync(sitemapFile)) {
    fail('dist/sitemap.xml', 'missing — run `npm run seo`');
  } else {
    const xml = readFileSync(sitemapFile, 'utf8');
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);

    if (locs.length !== indexable.length) {
      fail('dist/sitemap.xml', `has ${locs.length} urls but ${indexable.length} routes are indexable`);
    }
    for (const loc of locs) {
      const path = canonicalPath(loc.replace(site.url, '') || '/');
      const route = routes.find((r) => canonicalPath(r.path) === path);
      if (!route) fail('dist/sitemap.xml', `${loc} is not a registered route`);
      else if (!route.index) fail('dist/sitemap.xml', `${loc} is in the sitemap but marked noindex`);
    }
  }

  const robotsFile = join(DIST, 'robots.txt');
  if (!existsSync(robotsFile)) {
    fail('dist/robots.txt', 'missing — run `npm run seo`');
  } else {
    const txt = readFileSync(robotsFile, 'utf8');
    if (!txt.includes(`Sitemap: ${site.url}/sitemap.xml`)) {
      fail('dist/robots.txt', 'does not point at the sitemap');
    }
    // Disallowing a page that also serves noindex means the noindex is never
    // read, and anything already indexed stays indexed.
    for (const line of txt.split('\n')) {
      const m = line.match(/^Disallow:\s*(\/\S*)/);
      if (!m || m[1] === '/') continue;
      const blocked = canonicalPath(m[1]);
      const clash = routes.find(
        (r) => !r.index && !r.path.includes(':') && canonicalPath(r.path) === blocked,
      );
      if (clash) {
        fail('dist/robots.txt', `"Disallow: ${m[1]}" blocks a noindex page — crawlers can never read its noindex`);
      }
    }
  }

  const og = join(DIST, 'og-image.png');
  if (!existsSync(og)) {
    fail('dist/og-image.png', 'missing — social shares will have no image');
  } else {
    const buf = readFileSync(og);
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    if (w < 600 || h < 315) {
      fail('dist/og-image.png', `${w}x${h} is below the 600x315 minimum for a large share card`);
    } else if (Math.abs(w / h - 1.91) > 0.1) {
      warn('dist/og-image.png', `${w}x${h} is not the 1.91:1 ratio platforms crop to`);
    }
  }
}

/* ------------------------------------------------------------------ report */

const line = (entry) => `  ${entry.where.padEnd(24)} ${entry.msg}`;

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  warnings.forEach((w) => console.log(line(w)));
}

if (errors.length) {
  console.log(`\n${errors.length} error(s):`);
  errors.forEach((e) => console.log(line(e)));
  console.log('\n[seo:check] FAILED\n');
  process.exit(1);
}

const indexableCount = routes.filter((r) => r.index).length;
console.log(
  `\n[seo:check] OK — ${routes.length} routes (${indexableCount} indexable), ` +
    `${faq?.length ?? 0} FAQ entries` +
    (distChecked ? ', dist/ verified' : ', dist/ not built (skipped)') +
    (warnings.length ? `, ${warnings.length} warning(s)` : '') +
    '\n',
);
