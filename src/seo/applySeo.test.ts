import { MANAGED_ATTR, applySeo, type ResolvedSeo } from './applySeo';

const base: ResolvedSeo = {
  title: 'One | AlertUp',
  description: 'first',
  keywords: ['a', 'b'],
  canonicalUrl: 'https://alertup.world/one',
  imageUrl: 'https://alertup.world/og-image.png',
  imageAlt: 'alt',
  robots: 'index, follow',
  type: 'website',
  jsonLd: { '@context': 'https://schema.org', '@graph': [] },
};

const meta = (sel: string) => document.head.querySelectorAll(`meta[${sel}]`);

beforeEach(() => {
  document.head.innerHTML = '<meta name="viewport" content="width=device-width">';
});

it('writes title, description, canonical, keywords and JSON-LD', () => {
  applySeo(base);
  expect(document.title).toBe('One | AlertUp');
  expect(meta('name="description"')[0].getAttribute('content')).toBe('first');
  expect(meta('name="keywords"')[0].getAttribute('content')).toBe('a, b');
  expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(base.canonicalUrl);
  expect(document.head.querySelector('script[type="application/ld+json"]')?.textContent).toContain('schema.org');
});

it('replaces the previous page tags instead of stacking them', () => {
  applySeo(base);
  applySeo({ ...base, description: 'second', keywords: [], jsonLd: null });
  const descs = meta('name="description"');
  expect(descs).toHaveLength(1);
  expect(descs[0].getAttribute('content')).toBe('second');
  expect(meta('name="keywords"')).toHaveLength(0);
  expect(document.head.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(0);
  expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
});

it('leaves static head tags from index.html alone', () => {
  applySeo(base);
  applySeo(base);
  const viewport = meta('name="viewport"');
  expect(viewport).toHaveLength(1);
  expect(viewport[0].hasAttribute(MANAGED_ATTR)).toBe(false);
});
