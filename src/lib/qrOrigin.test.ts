import { qrPublicOrigin } from './qrOrigin';

/* FX-099 — where a printed QR code points.
   Every code pointed at https://www.alertup.world, so a code printed from stage
   sent people to production, and a code printed while testing the local MVP
   from a phone on the LAN could not reach the machine serving it. */

test.each([
  ['https://www.alertup.world', 'www.alertup.world', 'https://www.alertup.world'],
  ['https://alertup.world', 'alertup.world', 'https://www.alertup.world'],
  ['https://stage.alertup.world', 'stage.alertup.world', 'https://stage.alertup.world'],
  ['https://pre-prod.alertup.world', 'pre-prod.alertup.world', 'https://pre-prod.alertup.world'],
  ['http://192.168.1.20:5173', '192.168.1.20', 'http://192.168.1.20:5173'],
  ['http://localhost:5173', 'localhost', 'https://www.alertup.world'],
  ['http://127.0.0.1:5173', '127.0.0.1', 'https://www.alertup.world'],
])('%s → %s', (origin, hostname, expected) => {
  expect(qrPublicOrigin({ origin, hostname })).toBe(expected);
});
