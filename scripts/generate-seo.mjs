/**
 * Post-build SEO generator.
 *
 * AlertUp is a client-rendered SPA, so a crawler that fetches /scan normally
 * receives the same empty index.html as every other URL: one title, one
 * description, no content. This script fixes that without adding SSR.
 *
 * After `vite build` it:
 *   1. writes dist/robots.txt
 *   2. writes dist/sitemap.xml from the indexable routes
 *   3. emits dist/<route>/index.html for every indexable route, with that
 *      route's title, description, canonical, Open Graph, Twitter card and
 *      JSON-LD baked into <head>, plus real copy inside <noscript>
 *   4. regenerates dist/og-image.png from og-image.svg when sharp is installed
 *
 * Vercel resolves the filesystem before applying the SPA rewrite in
 * vercel.json, so /scan is served from dist/scan/index.html while every unknown
 * URL still falls through to the SPA shell.
 *
 * Page metadata lives in src/seo/seo.data.json — edit that, not this file.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = join(ROOT, 'dist');
const DATA = join(ROOT, 'src', 'seo', 'seo.data.json');

const SEO_BLOCK = /<!--seo:start-->[\s\S]*?<!--seo:end-->/;
const NOSCRIPT_BLOCK = /<!--seo:noscript:start-->[\s\S]*?<!--seo:noscript:end-->/;

/* ------------------------------------------------------------------ utils */

const esc = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const canonicalPath = (path) => {
  const clean = path.split('?')[0].split('#')[0];
  const prefixed = clean.startsWith('/') ? clean : `/${clean}`;
  return prefixed.length > 1 && prefixed.endsWith('/')
    ? prefixed.slice(0, -1)
    : prefixed;
};

const absoluteUrl = (site, path) =>
  /^https?:\/\//i.test(path) ? path : `${site.url}${canonicalPath(path)}`;

const buildTitle = (site, title, useDefaultTitle) => {
  if (!title) return site.defaultTitle;
  if (useDefaultTitle || title === site.defaultTitle) return title;
  if (title.includes(site.name)) return title;
  return site.titleTemplate.replace('%s', title);
};

/* ------------------------------------------------------------- structured */
/**
 * Mirrors src/seo/structuredData.ts. Both read the same seo.data.json, so only
 * the schema.org shape can drift — keep the two in step when adding nodes.
 */
function buildGraph(site, route, faq, howTo) {
  const organizationId = `${site.url}/#organization`;
  const websiteId = `${site.url}/#website`;
  const softwareId = `${site.url}/#software`;
  const isHome = canonicalPath(route.path) === '/';

  const nodes = [
    {
      '@type': 'Organization',
      '@id': organizationId,
      name: site.name,
      legalName: site.legalName,
      url: site.url,
      description: site.defaultDescription,
      email: site.email,
      logo: {
        '@type': 'ImageObject',
        url: absoluteUrl(site, '/icon-512.png'),
        width: 512,
        height: 512,
      },
      image: absoluteUrl(site, site.defaultImage),
      founder: { '@type': 'Person', name: site.founder },
      foundingLocation: { '@type': 'Place', name: site.foundingLocation },
      sameAs: site.sameAs,
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: site.email,
        url: absoluteUrl(site, '/contact'),
        availableLanguage: ['English'],
      },
    },
    {
      '@type': 'WebSite',
      '@id': websiteId,
      url: site.url,
      name: site.name,
      description: site.defaultDescription,
      inLanguage: site.lang,
      publisher: { '@id': organizationId },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': softwareId,
      name: site.name,
      url: site.url,
      description: site.defaultDescription,
      applicationCategory: 'SecurityApplication',
      applicationSubCategory: 'Emergency evacuation and building safety',
      operatingSystem: 'Any — runs in a web browser',
      browserRequirements:
        'Requires a modern browser with camera access for QR scanning.',
      softwareHelp: absoluteUrl(site, '/contact'),
      screenshot: absoluteUrl(site, site.defaultImage),
      featureList: [
        'QR code access to evacuation routes without installing an app',
        'Per-floor escape and evacuation maps',
        'Step-by-step emergency instructions',
        'Printable QR codes for every location in a building',
        'Scan and emergency analytics for building owners',
      ],
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        availability: 'https://schema.org/OnlineOnly',
        description:
          'Free to create an account and register your first building.',
      },
      publisher: { '@id': organizationId },
      isPartOf: { '@id': websiteId },
    },
  ];

  // A noindex page has no business declaring a WebPage node — it is not meant
  // to exist as a search result at all. This matches webPageJsonLd() usage in
  // src/seo/Seo.tsx.
  if (route.index) {
    nodes.push({
      '@type': 'WebPage',
      '@id': `${absoluteUrl(site, route.path)}#webpage`,
      url: absoluteUrl(site, route.path),
      name: buildTitle(site, route.title, route.useDefaultTitle),
      description: route.description,
      inLanguage: site.lang,
      isPartOf: { '@id': websiteId },
      about: { '@id': softwareId },
      primaryImageOfPage: {
        '@type': 'ImageObject',
        url: absoluteUrl(site, site.defaultImage),
      },
    });
  }

  if (!isHome && route.index) {
    nodes.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: absoluteUrl(site, '/'),
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: route.content?.h1 ?? route.title,
          item: absoluteUrl(site, route.path),
        },
      ],
    });
  }

  // FAQ and HowTo rich results are anchored to the homepage so Google has a
  // single canonical source for each.
  if (isHome) {
    nodes.push({
      '@type': 'FAQPage',
      '@id': `${site.url}/#faq`,
      mainEntity: faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    });
    nodes.push({
      '@type': 'HowTo',
      '@id': `${site.url}/#howto`,
      name: howTo.name,
      description: howTo.description,
      totalTime: howTo.totalTime,
      image: absoluteUrl(site, site.defaultImage),
      step: howTo.steps.map((step, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: step.name,
        text: step.text,
        url: `${site.url}/#step-${i + 1}`,
      })),
    });
  }

  return { '@context': 'https://schema.org', '@graph': nodes };
}

/* ------------------------------------------------------------------ blocks */

function renderSeoBlock(site, route, graph) {
  const title = buildTitle(site, route.title, route.useDefaultTitle);
  const url = absoluteUrl(site, route.path);
  const image = absoluteUrl(site, site.defaultImage);
  const keywords = (route.keywords ?? site.keywords).join(', ');
  const follow = route.follow ?? true;
  const robots = route.index
    ? `index, ${follow ? 'follow' : 'nofollow'}, max-snippet:-1, max-image-preview:large, max-video-preview:-1`
    : `noindex, ${follow ? 'follow' : 'nofollow'}`;

  // Every tag carries `data-seo` so that when React boots, <Seo /> replaces
  // these rather than stacking a second description, canonical and JSON-LD on
  // top of them. <title> is exempt: applySeo assigns document.title, which
  // updates the existing element in place.
  return `<!--seo:start-->
    <title>${esc(title)}</title>
    <meta data-seo name="description" content="${esc(route.description)}" />
    <meta data-seo name="keywords" content="${esc(keywords)}" />
    <meta data-seo name="robots" content="${robots}" />
    <meta data-seo name="googlebot" content="${robots}" />
    <link data-seo rel="canonical" href="${esc(url)}" />

    <meta data-seo property="og:site_name" content="${esc(site.name)}" />
    <meta data-seo property="og:type" content="website" />
    <meta data-seo property="og:locale" content="${esc(site.locale)}" />
    <meta data-seo property="og:title" content="${esc(title)}" />
    <meta data-seo property="og:description" content="${esc(route.description)}" />
    <meta data-seo property="og:url" content="${esc(url)}" />
    <meta data-seo property="og:image" content="${esc(image)}" />
    <meta data-seo property="og:image:width" content="1200" />
    <meta data-seo property="og:image:height" content="630" />
    <meta data-seo property="og:image:alt" content="${esc(site.defaultImageAlt)}" />

    <meta data-seo name="twitter:card" content="summary_large_image" />
    <meta data-seo name="twitter:title" content="${esc(title)}" />
    <meta data-seo name="twitter:description" content="${esc(route.description)}" />
    <meta data-seo name="twitter:image" content="${esc(image)}" />
    <meta data-seo name="twitter:image:alt" content="${esc(site.defaultImageAlt)}" />

    <script data-seo type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>
    <!--seo:end-->`;
}

function renderNoscriptBlock(site, route) {
  const content = route.content;
  if (!content) {
    return `<!--seo:noscript:start-->
      <h1>${esc(buildTitle(site, route.title, route.useDefaultTitle))}</h1>
      <p>${esc(route.description)}</p>
      <!--seo:noscript:end-->`;
  }

  const bullets = content.bullets?.length
    ? `\n      <ul>\n${content.bullets
        .map((b) => `        <li>${esc(b)}</li>`)
        .join('\n')}\n      </ul>`
    : '';

  const links = content.links?.length
    ? `\n      <p>${content.links
        .map((l) => `<a href="${esc(l.href)}">${esc(l.text)}</a>`)
        .join(' · ')}</p>`
    : '';

  return `<!--seo:noscript:start-->
      <h1>${esc(content.h1)}</h1>
      <p>${esc(content.lead)}</p>${bullets}${links}
      <!--seo:noscript:end-->`;
}

/* ------------------------------------------------------------------- files */

function writeSitemap(site, routes, lastmod) {
  const urls = routes
    .map((route) => {
      const parts = [
        `    <loc>${esc(absoluteUrl(site, route.path))}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
      ];
      if (route.changefreq) parts.push(`    <changefreq>${route.changefreq}</changefreq>`);
      if (typeof route.priority === 'number') {
        parts.push(`    <priority>${route.priority.toFixed(1)}</priority>`);
      }
      return `  <url>\n${parts.join('\n')}\n  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  writeFileSync(join(DIST, 'sitemap.xml'), xml, 'utf8');
  return routes.length;
}

function writeRobots(site, routes) {
  // Only the parameterised spaces are blocked here. Static private routes such
  // as /login are deliberately left crawlable: each one is prerendered with a
  // `noindex` tag, and a URL blocked in robots.txt can never be fetched, so
  // Google would never see that tag — a page already in the index would simply
  // be frozen there. Blocking and noindexing the same URL is self-defeating.
  //
  // The parameterised routes are different: they are unbounded (one URL per QR
  // code), reachable only by scanning a physical code, and worth nothing in
  // search, so keeping crawlers out of them entirely is the right trade.
  const disallowed = routes
    .filter((route) => !route.index && route.path.includes(':'))
    .map((route) => {
      const path = canonicalPath(route.path);
      // A pattern like /building/:id becomes the /building/ prefix.
      return path.slice(0, path.indexOf('/:') + 1);
    });

  const unique = [...new Set(disallowed)].sort();

  const txt = `# ${site.name} — ${site.url}
# Generated by scripts/generate-seo.mjs — do not edit dist/robots.txt by hand.
#
# Private pages (/login, /dashboard, /settings, …) are NOT listed here on
# purpose. They each serve a noindex tag, which only works if crawlers are
# allowed to fetch the page and read it.

User-agent: *
Allow: /
${unique.map((path) => `Disallow: ${path}`).join('\n')}

User-agent: AhrefsBot
Crawl-delay: 10

User-agent: SemrushBot
Crawl-delay: 10

User-agent: MJ12bot
Disallow: /

Sitemap: ${site.url}/sitemap.xml
`;
  writeFileSync(join(DIST, 'robots.txt'), txt, 'utf8');
  return unique;
}

async function rasterizeOgImage() {
  const svg = join(ROOT, 'public', 'og-image.svg');
  if (!existsSync(svg)) return null;
  try {
    const { default: sharp } = await import('sharp');
    const info = await sharp(svg, { density: 200 })
      .resize(1200, 630)
      .png({ compressionLevel: 9 })
      .toFile(join(DIST, 'og-image.png'));
    return `${info.width}x${info.height}`;
  } catch {
    // sharp is optional — public/og-image.png is already copied by Vite.
    return null;
  }
}

/* -------------------------------------------------------------------- main */

async function main() {
  if (!existsSync(DIST)) {
    console.error('[seo] dist/ not found — run `vite build` first.');
    process.exit(1);
  }

  const { site, routes, faq, howTo } = JSON.parse(readFileSync(DATA, 'utf8'));
  const shell = readFileSync(join(DIST, 'index.html'), 'utf8');

  if (!SEO_BLOCK.test(shell)) {
    console.error(
      '[seo] The <!--seo:start--> / <!--seo:end--> markers are missing from index.html.',
    );
    process.exit(1);
  }

  const indexable = routes.filter(
    (route) => route.index && !route.path.includes(':'),
  );

  // Private routes are prerendered too. Their whole job is to carry a `noindex`
  // tag in the served HTML, so a crawler gets it from the response rather than
  // having to execute the bundle first.
  const prerenderable = routes.filter(
    (route) => !route.path.includes(':') && canonicalPath(route.path) !== '/404',
  );

  const lastmod = new Date().toISOString().slice(0, 10);

  for (const route of prerenderable) {
    const graph = buildGraph(site, route, faq, howTo);
    let html = shell
      .replace(SEO_BLOCK, renderSeoBlock(site, route, graph))
      .replace(NOSCRIPT_BLOCK, renderNoscriptBlock(site, route));

    // The <html lang> should follow the site language.
    html = html.replace(/<html lang="[^"]*"/, `<html lang="${site.lang}"`);

    const path = canonicalPath(route.path);
    const outFile =
      path === '/' ? join(DIST, 'index.html') : join(DIST, path, 'index.html');

    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, html, 'utf8');
    console.log(
      `[seo] prerendered ${path.padEnd(12)} ${route.index ? 'index  ' : 'noindex'} -> ${outFile.replace(DIST, 'dist')}`,
    );
  }

  // The SPA rewrite target. Anything not prerendered above — an unknown URL, or
  // a dynamic route like /scan/route/qr_abc — lands here.
  //
  // It must NOT be dist/index.html: that file is the homepage, so every 404 and
  // every QR route would be served as `index, follow` with a canonical pointing
  // at the homepage. That is a soft 404 that invites junk URLs into the index as
  // homepage duplicates. This shell says noindex and carries no canonical, and
  // <Seo /> fills in the correct metadata once React resolves the real route.
  const shellRoute = {
    path: '/',
    index: false,
    follow: true,
    useDefaultTitle: true,
    title: site.defaultTitle,
    description: site.defaultDescription,
  };

  const appShell = shell
    .replace(
      SEO_BLOCK,
      renderSeoBlock(site, shellRoute, buildGraph(site, shellRoute, faq, howTo)),
    )
    .replace(NOSCRIPT_BLOCK, renderNoscriptBlock(site, shellRoute))
    // renderSeoBlock always emits a canonical; on an unresolved URL there is no
    // honest value for it, so it comes back out.
    .replace(/\n\s*<link data-seo rel="canonical"[^>]*>/, '');

  writeFileSync(join(DIST, 'app.html'), appShell, 'utf8');
  console.log('[seo] spa shell    noindex -> dist\\app.html');

  const count = writeSitemap(site, indexable, lastmod);
  const blocked = writeRobots(site, routes);
  const og = await rasterizeOgImage();

  console.log(`[seo] sitemap.xml  ${count} urls (lastmod ${lastmod})`);
  console.log(`[seo] robots.txt   ${blocked.length} disallow rules`);
  console.log(`[seo] og-image.png ${og ?? 'copied from public/ (sharp not available)'}`);
}

main().catch((error) => {
  console.error('[seo] generation failed:', error);
  process.exit(1);
});
