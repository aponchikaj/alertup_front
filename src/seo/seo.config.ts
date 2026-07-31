/**
 * AlertUp SEO configuration.
 *
 * `seo.data.json` is the single source of truth for every piece of page metadata.
 * It is consumed twice:
 *   - at runtime by <Seo /> (src/seo/Seo.tsx)
 *   - at build time by scripts/generate-seo.mjs, which writes sitemap.xml,
 *     robots.txt and a prerendered HTML file per indexable route
 *
 * Keeping it as plain JSON is what makes that sharing possible — do not turn it
 * into a .ts module without updating the build script too.
 */
import rawSeoData from './seo.data.json';

export type SeoLink = {
  href: string;
  text: string;
};

export type SeoContent = {
  /** The single <h1> for the page. */
  h1: string;
  /** Opening paragraph, also used as the <noscript> fallback copy. */
  lead: string;
  bullets?: string[];
  links?: SeoLink[];
};

export type RouteSeo = {
  /** Route pattern; `:param` segments match a single path segment. */
  path: string;
  /** Whether search engines may index this URL. */
  index: boolean;
  /** Whether links on the page should be followed. Defaults to true. */
  follow?: boolean;
  /** sitemap.xml <priority>. Only used when `index` is true. */
  priority?: number;
  /** sitemap.xml <changefreq>. Only used when `index` is true. */
  changefreq?: string;
  /** Use the title verbatim instead of running it through the title template. */
  useDefaultTitle?: boolean;
  title: string;
  description: string;
  keywords?: string[];
  content?: SeoContent;
};

export type SiteSeo = {
  name: string;
  legalName: string;
  url: string;
  lang: string;
  locale: string;
  themeColor: string;
  backgroundColor: string;
  titleTemplate: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultImage: string;
  defaultImageAlt: string;
  founder: string;
  foundingLocation: string;
  email: string;
  sameAs: string[];
  keywords: string[];
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type HowTo = {
  name: string;
  description: string;
  totalTime: string;
  steps: { name: string; text: string }[];
};

export type SeoData = {
  site: SiteSeo;
  routes: RouteSeo[];
  faq: FaqItem[];
  howTo: HowTo;
};

const seoData = rawSeoData as unknown as SeoData;

export const SITE: SiteSeo = seoData.site;
export const ROUTES: RouteSeo[] = seoData.routes;
export const FAQ: FaqItem[] = seoData.faq;
export const HOW_TO: HowTo = seoData.howTo;

/** Routes that belong in sitemap.xml and can be prerendered as static HTML. */
export const INDEXABLE_ROUTES: RouteSeo[] = ROUTES.filter(
  (route) => route.index && !route.path.includes(':'),
);

/**
 * Normalises a pathname for use as a canonical URL: drops the query string,
 * the hash and any trailing slash (except for the site root).
 */
export function canonicalPath(pathname: string): string {
  const withoutQuery = pathname.split('?')[0].split('#')[0];
  const prefixed = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  if (prefixed.length > 1 && prefixed.endsWith('/')) {
    return prefixed.slice(0, -1);
  }
  return prefixed;
}

/** Turns a path or an already-absolute URL into an absolute https URL. */
export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${SITE.url}${canonicalPath(pathOrUrl)}`;
}

/** Applies the site title template unless the title is already complete. */
export function buildTitle(title?: string, useDefaultTitle = false): string {
  if (!title) return SITE.defaultTitle;
  if (useDefaultTitle || title === SITE.defaultTitle) return title;
  if (title.includes(SITE.name)) return title;
  return SITE.titleTemplate.replace('%s', title);
}

function routeMatches(pattern: string, pathname: string): boolean {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return false;
  return patternParts.every(
    (part, i) => part.startsWith(':') || part === pathParts[i],
  );
}

/** Finds the metadata entry for a pathname, preferring an exact match. */
export function getRouteSeo(pathname: string): RouteSeo | undefined {
  const path = canonicalPath(pathname);
  const exact = ROUTES.find((route) => route.path === path);
  if (exact) return exact;
  return ROUTES.find(
    (route) => route.path.includes(':') && routeMatches(route.path, path),
  );
}

/** The `robots` meta value for a given index/follow pair. */
export function robotsValue(index: boolean, follow = true): string {
  const base = `${index ? 'index' : 'noindex'}, ${follow ? 'follow' : 'nofollow'}`;
  if (!index) return base;
  // Ask Google and Bing for full-size image and snippet previews.
  return `${base}, max-snippet:-1, max-image-preview:large, max-video-preview:-1`;
}
