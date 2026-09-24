/**
 * <Seo /> — a dependency-free document head manager.
 *
 * Every routed page renders exactly one of these. It resolves defaults from the
 * route registry in seo.data.json, lets the page override any field, and writes
 * the result into <head>: title, description, canonical, robots, Open Graph,
 * Twitter cards and JSON-LD.
 *
 * The head-writing half lives in ./applySeo; this file resolves props against
 * the registry and drives it from an effect.
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
import { applySeo, type ResolvedSeo } from './applySeo';
import type { JsonLd } from './structuredData';
import type { RouteSeo } from './seo.config';

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

  // Compared by serialised value so callers can pass inline literals without
  // causing an effect loop; extracted so the dependency array stays statically
  // checkable (react-hooks/exhaustive-deps).
  const keywordsKey = JSON.stringify(keywords);
  const jsonLdKey = JSON.stringify(jsonLd);

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
    // `keywords` and `jsonLd` themselves are intentionally absent: their
    // serialised keys above stand in for them.
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
    keywordsKey,
    jsonLdKey,
  ]);

  return null;
};

export default Seo;
