import { useLayoutEffect, useRef } from "react";
import { animate, createScope, onScroll, stagger, type Scope } from "animejs";

/* ============================================================================
   AlertUp animation layer (anime.js v4)
   ----------------------------------------------------------------------------
   One hook, driven by data attributes, so pages describe *what* animates and
   this module owns *how*. Keeps timing/easing consistent across the app and
   honours prefers-reduced-motion in one place.

     data-hero               entrance: rises in on mount, staggered in DOM order
     data-reveal             scroll: fades up when it enters the viewport
     data-reveal-group       scroll: container whose data-reveal-item children
     data-reveal-item          rise in with a stagger when the group enters
     data-reveal="left|right" optional direction for single reveals

   Elements start visible in the markup; the animation's `from` values hide
   them at init. If JavaScript never runs (crawlers, noscript), content simply
   shows — nothing is hidden by CSS.
   ========================================================================= */

export const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const EASE = "outQuint";

const fromFor = (dir: string | null): Record<string, [number, number]> =>
  dir === "left"
    ? { translateX: [-32, 0] }
    : dir === "right"
      ? { translateX: [32, 0] }
      : { translateY: [28, 0] };

/**
 * Attach to a page's root element. Scans for the data attributes above and
 * wires entrance + scroll animations. Reverts everything on unmount so
 * navigating back replays cleanly.
 */
export function usePageAnimations<T extends HTMLElement = HTMLDivElement>() {
  const rootRef = useRef<T>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || reducedMotion()) return;

    const scope: Scope = createScope({ root }).add(() => {
      // Entrance — everything tagged data-hero rises in, in DOM order.
      const heroEls = root.querySelectorAll<HTMLElement>("[data-hero]");
      if (heroEls.length) {
        animate(heroEls, {
          opacity: [0, 1],
          translateY: [26, 0],
          duration: 750,
          delay: stagger(95),
          ease: EASE,
        });
      }

      // Single scroll reveals.
      root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
        animate(el, {
          opacity: [0, 1],
          ...fromFor(el.getAttribute("data-reveal")),
          duration: 800,
          ease: EASE,
          autoplay: onScroll({ target: el, enter: "bottom 88%" }),
        });
      });

      // Staggered groups — the group is the scroll trigger, items animate.
      root
        .querySelectorAll<HTMLElement>("[data-reveal-group]")
        .forEach((group) => {
          const items = group.querySelectorAll<HTMLElement>(
            "[data-reveal-item]",
          );
          if (!items.length) return;
          animate(items, {
            opacity: [0, 1],
            translateY: [24, 0],
            duration: 700,
            delay: stagger(110),
            ease: EASE,
            autoplay: onScroll({ target: group, enter: "bottom 85%" }),
          });
        });
    });

    return () => scope.revert();
  }, []);

  return rootRef;
}

/**
 * Animated number for stat counters. Pass the target element and final value;
 * counts up when the element scrolls into view.
 */
export function countUp(
  el: HTMLElement,
  to: number,
  { duration = 1400, suffix = "" }: { duration?: number; suffix?: string } = {},
) {
  if (reducedMotion()) {
    el.textContent = `${to}${suffix}`;
    return;
  }
  const state = { value: 0 };
  animate(state, {
    value: to,
    duration,
    ease: "outExpo",
    autoplay: onScroll({ target: el, enter: "bottom 90%" }),
    onUpdate: () => {
      el.textContent = `${Math.round(state.value)}${suffix}`;
    },
  });
}
