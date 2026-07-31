/**
 * Joins class names, dropping falsy entries. Deliberately not a Tailwind-merge:
 * the primitives put variant classes first and spread `className` last, which
 * is enough for the conflicts this app actually has.
 */
export const cn = (...classes: (string | false | null | undefined)[]): string =>
  classes.filter(Boolean).join(" ");

export default cn;
