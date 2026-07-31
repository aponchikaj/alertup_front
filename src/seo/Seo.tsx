/**
 * <Seo /> — a dependency-free document head manager.
 *
 * Every routed page renders exactly one of these. It resolves defaults from the
 * route registry in seo.data.json, lets the page override any field, and writes
 * the result into <head>: title, description, canonical, robots, Open Graph,
 * Twitter cards and JSON-LD.
 *
 * Managed tags carry `data-seo` so a page transition can atomically replace the
 * previous page's tags without touching the static ones in index.html.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  SITE,
  absoluteUrl,
  buildTitle,
  canonicalPath,
  getRouteSeo,
  robotsValue,
} from './seo.config';
import { baseGraph, graph, webPageJsonLd } from './structuredData';
import type { JsonLd } from './structuredData';
import type { RouteSeo } from './seo.config';

const MANAGED_ATTR = 'data-seo';

export type SeoProps = {
  title?: string;
  description?: string;
  keywords?: string[];
  /** Canonical path or absolute URL. Defaults to the current pathname. */
  canonical?: string;
  /** Social share image path or absolute URL. */
  image?: string;
  imageAlt?: string;
  index?: boolean;
  follow?: boolean;
  type?: 'website' | 'article';
  /** Extra schema.org nodes merged into this page's @graph. */
  jsonLd?: JsonLd[];
  /** Omit the Organization/WebSite/SoftwareApplication base graph. */
  skipBaseGraph?: boolean;
  /** Use the title verbatim instead of appending the site name. */
  rawTitle?: boolean;
  /**
   * Marks this instance as the app-level safety net. It applies the route
   * registry's defaults only when the mounted page did not render its own
   * <Seo />, so a page can never inherit the previous route's metadata.
   */
  fallback?: boolean;
};

/**
 * The pathname most recently claimed by a page-level <Seo />.
 *
 * React flushes child effects before parent effects, so a page's <Seo /> always
 * runs before the app-level `<Seo fallback />` and gets to claim the route
 * first. Module scope is deliberate: this is a property of the document, and
 * there is only ever one document.
 */
let claimedPath: string | null = null;

type ResolvedSeo = {
  title: string;
  description: string;
  keywords: string[];
  canonicalUrl: string;
  imageUrl: string;
  imageAlt: string;
  robots: string;
  type: string;
  jsonLd: JsonLd | null;
};

function resolve(props: SeoProps, pathname: string): ResolvedSeo {
  const route: RouteSeo | undefined = getRouteSeo(pathname);

  const index = props.index ?? route?.index ?? false;
  const follow = props.follow ?? route?.follow ?? true;

  const rawTitle = props.title ?? route?.title;
  const useRaw = props.rawTitle ?? route?.useDefaultTitle ?? false;

  const canonicalSource = props.canonical ?? route?.path ?? pathname;
  // A route pattern still holding `:params` can't be a canonical URL — in that
  // case fall back to the URL actually being viewed.
  const canonicalTarget = canonicalSource.includes(':')
    ? pathname
    : canonicalSource;

  const nodes: JsonLd[] = [];
  if (!props.skipBaseGraph) nodes.push(...baseGraph());
  if (route && index) nodes.push(webPageJsonLd(route));
  if (props.jsonLd) nodes.push(...props.jsonLd);

  return {
    title: buildTitle(rawTitle, useRaw),
    description: props.description ?? route?.description ?? SITE.defaultDescription,
    keywords: props.keywords ?? route?.keywords ?? SITE.keywords,
    canonicalUrl: absoluteUrl(canonicalPath(canonicalTarget)),
    imageUrl: absoluteUrl(props.image ?? SITE.defaultImage),
    imageAlt: props.imageAlt ?? SITE.defaultImageAlt,
    robots: robotsValue(index, follow),
    type: props.type ?? 'website',
    jsonLd: nodes.length ? graph(nodes) : null,
  };
}

function createMeta(
  doc: Document,
  keyAttr: 'name' | 'property',
  key: string,
  content: string,
): HTMLMetaElement {
  const el = doc.createElement('meta');
  el.setAttribute(keyAttr, key);
  el.setAttribute('content', content);
  el.setAttribute(MANAGED_ATTR, '');
  return el;
}

/**
 * Writes the resolved metadata into `doc.head`, replacing anything a previous
 * call left behind. Exported so it can be unit tested without React.
 */
export function applySeo(seo: ResolvedSeo, doc: Document = document): void {
  doc.title = seo.title;

  doc.querySelectorAll(`[${MANAGED_ATTR}]`).forEach((el) => el.remove());

  const fragment = doc.createDocumentFragment();

  fragment.append(
    createMeta(doc, 'name', 'description', seo.description),
    createMeta(doc, 'name', 'robots', seo.robots),
    createMeta(doc, 'name', 'googlebot', seo.robots),

    createMeta(doc, 'property', 'og:site_name', SITE.name),
    createMeta(doc, 'property', 'og:type', seo.type),
    createMeta(doc, 'property', 'og:locale', SITE.locale),
    createMeta(doc, 'property', 'og:title', seo.title),
    createMeta(doc, 'property', 'og:description', seo.description),
    createMeta(doc, 'property', 'og:url', seo.canonicalUrl),
    createMeta(doc, 'property', 'og:image', seo.imageUrl),
    createMeta(doc, 'property', 'og:image:alt', seo.imageAlt),
    createMeta(doc, 'property', 'og:image:width', '1200'),
    createMeta(doc, 'property', 'og:image:height', '630'),

    createMeta(doc, 'name', 'twitter:card', 'summary_large_image'),
    createMeta(doc, 'name', 'twitter:title', seo.title),
    createMeta(doc, 'name', 'twitter:description', seo.description),
    createMeta(doc, 'name', 'twitter:image', seo.imageUrl),
    createMeta(doc, 'name', 'twitter:image:alt', seo.imageAlt),
  );

  if (seo.keywords.length) {
    fragment.append(createMeta(doc, 'name', 'keywords', seo.keywords.join(', ')));
  }

  const canonical = doc.createElement('link');
  canonical.setAttribute('rel', 'canonical');
  canonical.setAttribute('href', seo.canonicalUrl);
  canonical.setAttribute(MANAGED_ATTR, '');
  fragment.append(canonical);

  if (seo.jsonLd) {
    const script = doc.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.setAttribute(MANAGED_ATTR, '');
    script.textContent = JSON.stringify(seo.jsonLd);
    fragment.append(script);
  }

  doc.head.append(fragment);
}

const Seo = (props: SeoProps) => {
  const { pathname } = useLocation();

  const {
    title,
    description,
    keywords,
    canonical,
    image,
    imageAlt,
    index,
    follow,
    type,
    jsonLd,
    skipBaseGraph,
    rawTitle,
    fallback,
  } = props;

  useEffect(() => {
    if (fallback) {
      // A page-level <Seo /> already described this route — leave it alone.
      if (claimedPath === pathname) return;
    } else {
      claimedPath = pathname;
    }

    applySeo(
      resolve(
        {
          title,
          description,
          keywords,
          canonical,
          image,
          imageAlt,
          index,
          follow,
          type,
          jsonLd,
          skipBaseGraph,
          rawTitle,
        },
        pathname,
      ),
    );
    // `keywords` and `jsonLd` are compared by serialised value so callers can
    // pass inline literals without causing an effect loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pathname,
    title,
    description,
    canonical,
    image,
    imageAlt,
    index,
    follow,
    type,
    skipBaseGraph,
    rawTitle,
    fallback,
    JSON.stringify(keywords),
    JSON.stringify(jsonLd),
  ]);

  return null;
};

export default Seo;
