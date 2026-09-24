import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * A ref that always holds the latest value, without writing to it during
 * render.
 *
 * The common `const r = useRef(v); r.current = v;` idiom mutates a ref while
 * rendering, which react-hooks/refs rejects: under concurrent rendering a
 * render can be thrown away or replayed, so the ref may end up holding a value
 * that was never committed. Assigning in a layout effect keeps the same
 * "stable identity, fresh value" guarantee that natively-bound listeners and
 * long-lived callbacks rely on, and still lands before paint and before any
 * passive effect reads it.
 */
export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

export default useLatestRef;
