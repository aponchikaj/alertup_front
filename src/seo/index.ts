export { default as Seo } from './Seo';
export type { SeoProps } from './Seo';

export {
  SITE,
  ROUTES,
  FAQ,
  HOW_TO,
  INDEXABLE_ROUTES,
  absoluteUrl,
  buildTitle,
  canonicalPath,
  getRouteSeo,
  robotsValue,
} from './seo.config';
export type { RouteSeo, SiteSeo, FaqItem, HowTo, SeoContent, SeoLink } from './seo.config';

export {
  baseGraph,
  breadcrumbJsonLd,
  faqJsonLd,
  graph,
  howToJsonLd,
  organizationJsonLd,
  softwareApplicationJsonLd,
  webPageJsonLd,
  websiteJsonLd,
} from './structuredData';
export type { JsonLd } from './structuredData';
