/**
 * The pure half of API origin resolution.
 *
 * Kept out of `env.ts` deliberately: that module touches `import.meta` and is
 * therefore swapped for a stub under Jest, which would leave this logic with
 * no test coverage at all. Nothing here reads the environment, so it runs
 * everywhere.
 */

/** Hosts that must talk to the stage backend rather than production. */
export const STAGE_HOSTS = new Set(['stage.alertup.world', 'pre-prod.alertup.world']);

export const PROD_API = 'https://alertup-backend.fly.dev';
export const STAGE_API = 'https://alertup-backend-stage.fly.dev';

/**
 * Turn a configured VITE_API_URL into an absolute origin.
 *
 * A scheme-less value such as "alertup-backend.fly.dev" is trivially easy to
 * paste into a dashboard field, and it is not an absolute URL — the browser
 * resolves it against the current page, so every request lands on the frontend
 * host and 404s. Assuming https beats taking the whole API down.
 *
 * @returns the normalized origin, or null when nothing usable was configured.
 */
export const normalizeApiBase = (configured: string | undefined | null): string | null => {
  const trimmed = configured?.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

/** Backend origin for a frontend hostname, when nothing is configured. */
export const apiBaseForHost = (hostname: string): string =>
  STAGE_HOSTS.has(hostname) ? STAGE_API : PROD_API;
