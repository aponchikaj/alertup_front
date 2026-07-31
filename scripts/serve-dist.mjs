/**
 * Static preview that resolves URLs the way Vercel does.
 *
 * `vite preview` answers *every* path with the root index.html, which makes the
 * prerendered per-route files in dist/ invisible and gives a misleading picture
 * of what production serves. This server applies Vercel's actual order:
 *
 *   1. exact file            /og-image.png      -> dist/og-image.png
 *   2. directory index       /scan              -> dist/scan/index.html
 *   3. SPA rewrite fallback  /building/abc123   -> dist/app.html
 *
 * Use it to confirm that a route really is prerendered before deploying:
 *
 *   npm run build
 *   npm run preview:static
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const PORT = Number(process.env.PORT) || 4180;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};

async function readIfFile(path) {
  try {
    const info = await stat(path);
    if (!info.isFile()) return null;
    return await readFile(path);
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

  // Refuse to escape dist/ via ../ segments.
  const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const target = join(DIST, safe);

  let body = await readIfFile(target);
  let file = target;
  let how = 'file';

  if (!body) {
    file = join(target, 'index.html');
    body = await readIfFile(file);
    how = 'directory-index';
  }

  if (!body) {
    // Mirrors the rewrite destination in vercel.json. app.html is the noindex
    // shell, deliberately not the homepage.
    file = join(DIST, 'app.html');
    body = (await readIfFile(file)) ?? (await readIfFile(join(DIST, 'index.html')));
    how = 'spa-fallback';
  }

  if (!body) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('dist/ not built — run `npm run build` first.\n');
    return;
  }

  res.writeHead(200, {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'X-Resolved-By': how,
  });
  res.end(body);
});

server.listen(PORT, () => {
  console.log(`dist/ served on http://localhost:${PORT} (Vercel resolution order)`);
  console.log('Each response carries X-Resolved-By: file | directory-index | spa-fallback');
});
