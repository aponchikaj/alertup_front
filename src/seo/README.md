# AlertUp SEO system

AlertUp is a client-rendered Vite SPA. Left alone, that means every URL on the
site returns the same empty `index.html` with the same title and the same
description, and a crawler that does not run JavaScript sees no content at all.

This directory plus `scripts/generate-seo.mjs` fixes that without introducing
SSR, a framework migration, or a runtime dependency.

## The one file you edit

**`seo.data.json`** is the single source of truth. Titles, descriptions,
keywords, sitemap priority, `index`/`noindex`, the FAQ, and the how-it-works
steps all live there.

It is deliberately plain JSON because two very different consumers read it:

| Consumer | When | What it does |
| --- | --- | --- |
| `Seo.tsx` | runtime, in the browser | rewrites `<head>` on every route change |
| `scripts/generate-seo.mjs` | build time, in Node | writes `sitemap.xml`, `robots.txt`, and one prerendered HTML file per indexable route |

Turning it into a `.ts` module would break the build script. Don't.

## Adding a page

1. Add a route object to the `routes` array in `seo.data.json`:

   ```jsonc
   {
     "path": "/pricing",
     "index": true,
     "priority": 0.8,
     "changefreq": "monthly",
     "title": "AlertUp Pricing — Free to Start",
     "description": "…155 characters or fewer…",
     "keywords": ["evacuation software pricing"],
     "content": {
       "h1": "Pricing",
       "lead": "Copy shown to crawlers that do not run JavaScript.",
       "bullets": ["…"],
       "links": [{ "href": "/register", "text": "Create a free account" }]
     }
   }
   ```

2. That's it. The app-level `<Seo fallback />` in `App.tsx` picks the entry up by
   pathname, and `npm run build` regenerates the sitemap, robots rules and a
   prerendered `dist/pricing/index.html`.

Set `"index": false` for anything behind auth. Those routes get
`noindex, follow`, are excluded from the sitemap, and are added to `robots.txt`
automatically.

## Runtime: `<Seo />`

`App.tsx` renders `<Seo fallback />` once. It applies each route's registry
entry and is the reason no page can ever inherit the previous page's metadata —
the usual failure mode of hand-rolled SPA SEO.

A page only needs its own `<Seo />` when it has something extra to say:

```tsx
<Seo jsonLd={[breadcrumbJsonLd([
  { name: 'Home', path: '/' },
  { name: 'Scan a QR code', path: '/scan' },
])]} />
```

React flushes child effects before parent effects, so a page-level `<Seo />`
always runs first and claims the pathname; the fallback then sees the claim and
stands down. Overrides never fight.

Every tag `<Seo />` writes is marked `data-seo`, including the ones baked into
`index.html`. Applying a new route replaces that whole set atomically, which is
what keeps the page at exactly one `<title>`, one canonical, one description and
one JSON-LD block.

## Structured data

`structuredData.ts` builds a single `@graph` linked by stable `@id`s, so Google
reads the site as one entity rather than unrelated fragments:

```
{site}/#organization ──publisher──> {site}/#website ──isPartOf──> every WebPage
{site}/#software      the product (SoftwareApplication, free Offer)
{site}/#faq           FAQPage    — rendered visibly on the homepage
{site}/#howto         HowTo      — rendered visibly on the homepage
```

The FAQ and HowTo markup is only legitimate because the homepage actually
renders that copy, from the same JSON. If you ever remove those sections, remove
the schema nodes too — Google issues manual actions for FAQ markup that is not
visible on the page.

## Build output

`npm run build` runs `tsc -b && vite build && npm run seo`. The last step prints
exactly what it produced:

```
[seo] prerendered /            index   -> dist/index.html
[seo] prerendered /scan        index   -> dist/scan/index.html
[seo] prerendered /contact     index   -> dist/contact/index.html
[seo] prerendered /register    index   -> dist/register/index.html
[seo] prerendered /login       noindex -> dist/login/index.html
[seo] prerendered /dashboard   noindex -> dist/dashboard/index.html
…
[seo] sitemap.xml  4 urls
[seo] robots.txt   3 disallow rules
[seo] og-image.png 1200x630
```

Each prerendered file is the normal SPA shell with that route's real title,
description, canonical, Open Graph, Twitter card and JSON-LD in `<head>`, plus
real copy inside `<noscript>`. `#root` stays empty, so React boots normally with
no hydration mismatch.

Private routes are prerendered too, purely so their `noindex` arrives in the
HTML response instead of only after the bundle executes. That is also why
`robots.txt` does **not** disallow them: a URL blocked in `robots.txt` is never
fetched, so a crawler would never read the `noindex` on it, and anything already
in the index would stay there. Blocking and noindexing the same URL cancel each
other out. Only the unbounded `:param` spaces — `/building/`, `/route/`,
`/scan/route/` — are disallowed, since those are reachable only by scanning a
physical QR code and are worth nothing in search.

Vercel checks the filesystem **before** applying the SPA rewrite in
`vercel.json`, so `/scan` is served from `dist/scan/index.html` while unknown
URLs still fall through to the shell.

> `vite preview` does **not** reproduce this — its SPA fallback answers every
> path with the root `index.html`. To check prerendering locally, serve `dist/`
> with a plain static server (`npx serve dist`) instead.

## The social image

`public/og-image.svg` is the source. The build rasterizes it to a 1200×630
`og-image.png` using `sharp`. If `sharp` is unavailable the step is skipped and
the committed PNG is used, so the build never fails over an image.

Edit the SVG and rebuild to change the card.

## Checklist after deploying

- Submit `https://alertup.world/sitemap.xml` in Google Search Console
- Run the homepage through the [Rich Results Test](https://search.google.com/test/rich-results) — expect FAQ and HowTo to be eligible
- Check the share card with Facebook's Sharing Debugger and X's Card Validator
- Confirm `https://alertup.world/robots.txt` resolves and lists the sitemap
