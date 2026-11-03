/**
 * The DOM half of <Seo />: turning a resolved metadata record into head tags.
 *
 * Kept out of Seo.tsx so that file exports only a component
 * (react-refresh/only-export-components), and so these helpers can be unit
 * tested without React.
 *
 * Managed tags carry `data-seo` so a page transition can atomically replace the
 * previous page's tags without touching the static ones in index.html.
 */
import { SITE } from './seo.config';
import type { JsonLd } from './structuredData';

export const MANAGED_ATTR = 'data-seo';

export type ResolvedSeo = {
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

export function createMeta(
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
 * call left behind.
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
