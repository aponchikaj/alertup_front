import { safeNextPath } from './safeNext';

/* FX-024 — after login, return to where the user was going (the invite),
   without turning `?next=` into an open redirect. */

test('keeps a same-site path with its query', () => {
  expect(safeNextPath('/invite/abc123?x=1')).toBe('/invite/abc123?x=1');
});

test('decodes an encoded path', () => {
  expect(safeNextPath(encodeURIComponent('/invite/abc'))).toBe('/invite/abc');
});

test.each([
  ['missing', null],
  ['empty', ''],
  ['protocol-relative', '//evil.example/x'],
  ['backslash trick', '/\\evil.example'],
  ['absolute URL', 'https://evil.example'],
  ['javascript URL', 'javascript:alert(1)'],
  ['relative without slash', 'dashboard'],
  ['encoded protocol-relative', encodeURIComponent('//evil.example')],
])('falls back to the dashboard for %s', (_label, raw) => {
  expect(safeNextPath(raw)).toBe('/dashboard');
});

test('never loops back to the login page', () => {
  expect(safeNextPath('/login?next=/x')).toBe('/dashboard');
});
