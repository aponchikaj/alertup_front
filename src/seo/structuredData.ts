/**
 * schema.org JSON-LD builders.
 *
 * Everything is linked through stable `@id` values so Google reads the site as
 * one entity graph rather than a pile of unrelated snippets:
 *
 *   {site}/#organization  <-  publisher of  ->  {site}/#website
 *   {site}/#website       <-  isPartOf     ->  every WebPage
 *   {site}/#software      <-  the product itself (SoftwareApplication)
 */
import { FAQ, HOW_TO, SITE, absoluteUrl, buildTitle } from './seo.config';
import type { RouteSeo } from './seo.config';

export type JsonLd = Record<string, unknown>;

const ORGANIZATION_ID = `${SITE.url}/#organization`;
const WEBSITE_ID = `${SITE.url}/#website`;
const SOFTWARE_ID = `${SITE.url}/#software`;

export function organizationJsonLd(): JsonLd {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE.name,
    legalName: SITE.legalName,
    url: SITE.url,
    description: SITE.defaultDescription,
    email: SITE.email,
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl('/icon-512.png'),
      width: 512,
      height: 512,
    },
    image: absoluteUrl(SITE.defaultImage),
    founder: {
      '@type': 'Person',
      name: SITE.founder,
    },
    foundingLocation: {
      '@type': 'Place',
      name: SITE.foundingLocation,
    },
    sameAs: SITE.sameAs,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: SITE.email,
      url: absoluteUrl('/contact'),
      availableLanguage: ['English'],
    },
  };
}

export function websiteJsonLd(): JsonLd {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE.url,
    name: SITE.name,
    description: SITE.defaultDescription,
    inLanguage: SITE.lang,
    publisher: { '@id': ORGANIZATION_ID },
  };
}

/**
 * The product itself. `SecurityApplication` is the closest schema.org category
 * for a life-safety tool and is what makes AlertUp eligible for the software
 * rich result.
 */
export function softwareApplicationJsonLd(): JsonLd {
  return {
    '@type': 'SoftwareApplication',
    '@id': SOFTWARE_ID,
    name: SITE.name,
    url: SITE.url,
    description: SITE.defaultDescription,
    applicationCategory: 'SecurityApplication',
    applicationSubCategory: 'Emergency evacuation and building safety',
    operatingSystem: 'Any — runs in a web browser',
    browserRequirements: 'Requires a modern browser with camera access for QR scanning.',
    softwareHelp: absoluteUrl('/contact'),
    screenshot: absoluteUrl(SITE.defaultImage),
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
      description: 'Free to create an account and register your first building.',
    },
    publisher: { '@id': ORGANIZATION_ID },
    isPartOf: { '@id': WEBSITE_ID },
  };
}

export function faqJsonLd(): JsonLd {
  return {
    '@type': 'FAQPage',
    '@id': `${SITE.url}/#faq`,
    mainEntity: FAQ.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function howToJsonLd(): JsonLd {
  return {
    '@type': 'HowTo',
    '@id': `${SITE.url}/#howto`,
    name: HOW_TO.name,
    description: HOW_TO.description,
    totalTime: HOW_TO.totalTime,
    image: absoluteUrl(SITE.defaultImage),
    step: HOW_TO.steps.map((step, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: step.name,
      text: step.text,
      url: `${SITE.url}/#step-${i + 1}`,
    })),
  };
}

export function breadcrumbJsonLd(
  crumbs: { name: string; path: string }[],
): JsonLd {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

export function webPageJsonLd(route: RouteSeo): JsonLd {
  return {
    '@type': 'WebPage',
    '@id': `${absoluteUrl(route.path)}#webpage`,
    url: absoluteUrl(route.path),
    name: buildTitle(route.title, route.useDefaultTitle),
    description: route.description,
    inLanguage: SITE.lang,
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': SOFTWARE_ID },
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: absoluteUrl(SITE.defaultImage),
    },
  };
}

/** Wraps one or more nodes in a single `@graph` document. */
export function graph(nodes: JsonLd[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes,
  };
}

/**
 * The structured data every page carries. Individual pages append their own
 * nodes (FAQ, HowTo, breadcrumbs) on top of this.
 */
export function baseGraph(): JsonLd[] {
  return [organizationJsonLd(), websiteJsonLd(), softwareApplicationJsonLd()];
}
