/**
 * The one place `import.meta` is referenced.
 *
 * `import.meta` is valid only in an ES module, so any file touching it directly
 * cannot be compiled to CommonJS — which is what Jest uses. Keeping it isolated
 * here lets the test config swap this single module for a plain stub, instead
 * of forcing the whole suite into ESM mode where `jest.mock()` does not work.
 */
export const getApiBaseUrl = (): string => {
  const configured = import.meta.env?.VITE_API_URL as string | undefined;
  return (configured || 'https://alertup-backend.onrender.com').replace(/\/+$/, '');
};
