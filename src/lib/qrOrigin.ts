const PRODUCTION_ORIGIN = 'https://www.alertup.world';

/**
 * The origin a printed QR code should point at (FX-099).
 *
 * - Production (apex or www) → the canonical www origin, which skips a redirect.
 * - stage / pre-prod → that environment, so test stickers never send people
 *   to production.
 * - localhost → production: `localhost` means nothing on the phone that scans
 *   the sticker.
 * - Anything else (a LAN address while testing the local MVP from a phone) →
 *   the current origin, which that phone can reach.
 */
export function qrPublicOrigin(loc: { origin: string; hostname: string }): string {
  const host = loc.hostname;
  if (host === 'alertup.world' || host === 'www.alertup.world') return PRODUCTION_ORIGIN;
  if (host === 'localhost' || host.startsWith('127.') || host === '::1' || host === '[::1]') {
    return PRODUCTION_ORIGIN;
  }
  return loc.origin;
}
