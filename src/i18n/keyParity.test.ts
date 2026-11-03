import { en } from './messages/en';
import { ka } from './messages/ka';

/* ============================================================================
   Every English string must have a Georgian counterpart and vice versa.
   ka.ts is typed against `Messages`, which catches a missing key at compile
   time — but ts-jest runs without type diagnostics, and an extra or misnamed
   Georgian key is not a type error at all. This walks both trees.
   ========================================================================= */

const keyPaths = (node: unknown, prefix = ''): string[] => {
  if (typeof node !== 'object' || node === null) return [prefix];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    keyPaths(v, prefix ? `${prefix}.${k}` : k),
  );
};

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

const leaf = (dict: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((n, p) => (n as Record<string, unknown>)[p], dict);

test('en and ka have exactly the same key set', () => {
  const enKeys = keyPaths(en).sort();
  const kaKeys = keyPaths(ka).sort();
  expect(enKeys.filter((k) => !kaKeys.includes(k))).toEqual([]);
  expect(kaKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
});

test('every Georgian string is non-empty and keeps the English placeholders', () => {
  for (const path of keyPaths(en)) {
    const enValue = leaf(en, path);
    const kaValue = leaf(ka, path);
    expect(typeof kaValue).toBe(typeof enValue);
    if (typeof enValue !== 'string' || typeof kaValue !== 'string') continue;
    expect({ path, empty: kaValue.trim() === '' }).toEqual({ path, empty: false });
    expect({ path, vars: placeholders(kaValue) }).toEqual({ path, vars: placeholders(enValue) });
  }
});
