import {
  INDEXABLE_ROUTES,
  ROUTES,
  SITE,
  absoluteUrl,
  buildTitle,
  canonicalPath,
  getRouteSeo,
  robotsValue,
} from './seo.config';

describe('canonicalPath', () => {
  it('drops query, hash and trailing slash but keeps the root', () => {
    expect(canonicalPath('/pricing/?a=1#x')).toBe('/pricing');
    expect(canonicalPath('help')).toBe('/help');
    expect(canonicalPath('/')).toBe('/');
  });
});

describe('absoluteUrl', () => {
  it('prefixes the site origin and leaves absolute URLs alone', () => {
    expect(absoluteUrl('/scan/')).toBe(`${SITE.url}/scan`);
    expect(absoluteUrl('https://cdn.example/x.png')).toBe('https://cdn.example/x.png');
  });
});

describe('buildTitle', () => {
  it('applies the template only when the title lacks the site name', () => {
    expect(buildTitle()).toBe(SITE.defaultTitle);
    expect(buildTitle('Pricing')).toBe(SITE.titleTemplate.replace('%s', 'Pricing'));
    expect(buildTitle(`${SITE.name} Help`)).toBe(`${SITE.name} Help`);
    expect(buildTitle('Raw', true)).toBe('Raw');
  });
});

describe('getRouteSeo', () => {
  it('prefers an exact path over a :param pattern', () => {
    expect(getRouteSeo('/scan')?.path).toBe('/scan');
    expect(getRouteSeo('/scan/route/abc')?.path).toBe('/scan/route/:qrId');
  });

  it('matches whole segments only', () => {
    expect(getRouteSeo('/building/b1')?.path).toBe('/building/:buildingID');
    expect(getRouteSeo('/building/b1/extra')).toBeUndefined();
    expect(getRouteSeo('/nope')).toBeUndefined();
  });
});

describe('robotsValue', () => {
  it('adds preview hints only to indexable pages', () => {
    expect(robotsValue(false)).toBe('noindex, follow');
    expect(robotsValue(false, false)).toBe('noindex, nofollow');
    expect(robotsValue(true)).toMatch(/^index, follow, max-snippet:-1/);
  });
});

describe('seo.data.json invariants', () => {
  it('has unique paths', () => {
    const paths = ROUTES.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('never lets a param route or an auth page into the sitemap', () => {
    const indexable = INDEXABLE_ROUTES.map((r) => r.path);
    expect(indexable.every((p) => !p.includes(':'))).toBe(true);
    for (const p of ['/login', '/reset', '/dashboard', '/mybuildings', '/settings']) {
      expect(indexable).not.toContain(p);
    }
  });

  it('keeps descriptions within the 160-character snippet limit', () => {
    for (const r of ROUTES) expect(r.description.length).toBeLessThanOrEqual(160);
  });
});
