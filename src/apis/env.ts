/**
 * The one place `import.meta` is referenced.
 *
 * `import.meta` is valid only in an ES module, so any file touching it directly
 * cannot be compiled to CommonJS — which is what Jest uses. Keeping it isolated
 * here lets the test config swap this single module for a plain stub, instead
 * of forcing the whole suite into ESM mode where `jest.mock()` does not work.
 */
// Fly.io replaced Render. The old alertup-backend*.onrender.com services are
// deleted — they answer `x-render-routing: no-server` — so nothing may point
// at them any more.
const PROD_API = 'https://alertup-backend.fly.dev';
const STAGE_API = 'https://alertup-backend-stage.fly.dev';

// stage.alertup.world and pre-prod.alertup.world talk to the stage backend
// (which uses the stage database), so testing there never touches prod data.
const STAGE_HOSTS = new Set(['stage.alertup.world', 'pre-prod.alertup.world']);

export const getApiBaseUrl = (): string => {
  const configured = import.meta.env?.VITE_API_URL as string | undefined;
  if (configured) return configured.replace(/\/+$/, '');
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  return STAGE_HOSTS.has(host) ? STAGE_API : PROD_API;
};
