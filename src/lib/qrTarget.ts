/**
 * Hostnames a scanned QR code is allowed to send the user to.
 *
 * The scanner used to accept any string containing the substring "alertup",
 * which a malicious code could satisfy with something like
 * `https://evil.example.com/#alertup` — turning an emergency-safety app into an
 * open redirect. Matching is on the parsed hostname only.
 */
const ALLOWED_HOSTS = [
  "alertup.world",
  "www.alertup.world",
  "alertup.vercel.app",
];

/**
 * Resolve a scanned QR payload to a URL that is safe to navigate to.
 *
 * Returns the normalized absolute URL, or null when the payload does not point
 * at AlertUp.
 */
export const resolveQrTarget = (data: string): string | null => {
  if (!data || typeof data !== "string") return null;

  let url: URL;
  try {
    // The current origin is the base so relative payloads (e.g. "/building/x")
    // resolve against the app itself rather than being rejected.
    url = new URL(data.trim(), window.location.origin);
  } catch {
    return null;
  }

  // Blocks javascript:, data: and similar schemes.
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase();
  const isCurrentOrigin = host === window.location.hostname.toLowerCase();

  if (!isCurrentOrigin && !ALLOWED_HOSTS.includes(host)) return null;

  return url.toString();
};

export default resolveQrTarget;
