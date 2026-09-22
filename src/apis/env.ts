/**
 * The one place `import.meta` is referenced.
 *
 * `import.meta` is valid only in an ES module, so any file touching it directly
 * cannot be compiled to CommonJS — which is what Jest uses. Keeping it isolated
 * here lets the test config swap this single module for a plain stub, instead
 * of forcing the whole suite into ESM mode where `jest.mock()` does not work.
 *
 * Because this file is stubbed in tests, it holds no logic worth testing: the
 * decisions live in `apiBase.ts`, which is covered.
 */
import { normalizeApiBase, apiBaseForHost } from './apiBase';

export const getApiBaseUrl = (): string => {
  const configured = normalizeApiBase(import.meta.env?.VITE_API_URL as string | undefined);
  if (configured) return configured;
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  return apiBaseForHost(host);
};
