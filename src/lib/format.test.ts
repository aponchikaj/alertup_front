import { durationMinutes, formatDuration, formatDistance, formatDistanceAndEta } from './format';

/* ============================================================================
   Duration/distance formatting.
   ----------------------------------------------------------------------------
   durationMinutes never shows "0 min" — anything under a minute still reads
   as 1, and everything else rounds to the nearest whole minute (minimum 1).
   ========================================================================= */

describe('durationMinutes', () => {
  test('45 s rounds up to 1 min (never 0)', () => {
    expect(durationMinutes(45)).toBe(1);
  });

  test('150 s rounds to 3 min', () => {
    expect(durationMinutes(150)).toBe(3);
  });

  test('149 s rounds to 2 min', () => {
    expect(durationMinutes(149)).toBe(2);
  });
});

describe('formatDuration', () => {
  test('English', () => {
    expect(formatDuration(150, 'en')).toBe('3 min');
  });

  test('Georgian unit', () => {
    expect(formatDuration(150, 'ka')).toBe('3 წთ');
  });
});

describe('formatDistance', () => {
  test('English', () => {
    expect(formatDistance(120, 'en')).toBe('120 m');
  });

  test('Georgian unit', () => {
    expect(formatDistance(120, 'ka')).toBe('120 მ');
  });
});

describe('formatDistanceAndEta', () => {
  test('joins distance and eta with a middle dot (English)', () => {
    expect(formatDistanceAndEta(120, 150, 'en')).toBe('120 m · 3 min');
  });

  test('joins distance and eta with a middle dot (Georgian)', () => {
    expect(formatDistanceAndEta(120, 150, 'ka')).toBe('120 მ · 3 წთ');
  });
});
