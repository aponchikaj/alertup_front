import fs from 'node:fs';
import path from 'node:path';

// FX-095: building routes named the same parameter three ways (`:buildingID`,
// `:id`, `:buildingId`), so a guard or page reading the wrong name silently got
// undefined. One name everywhere.

test('every /building/... route names its first parameter :buildingId', () => {
  const app = fs.readFileSync(path.join(__dirname, 'App.tsx'), 'utf8');
  const paths = [...app.matchAll(/path="(\/building\/[^"]+)"/g)].map((m) => m[1]);
  expect(paths.length).toBeGreaterThan(0);
  const offenders = paths.filter((p) => !p.startsWith('/building/:buildingId'));
  expect(offenders).toEqual([]);
});
