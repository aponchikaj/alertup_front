/**
 * Escape a value before interpolating it into a raw HTML string.
 *
 * React escapes anything rendered through JSX, but the print flows build HTML
 * by hand and hand it to document.write in a window that shares this app's
 * origin — so a building or node named `<img src=x onerror=...>` would execute
 * there as the application itself.
 */
export const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export default escapeHtml;
