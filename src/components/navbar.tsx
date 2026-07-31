import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  animate,
  createScope,
  createTimeline,
  onScroll,
  stagger,
  type Scope,
} from "animejs";
import { useAuth } from "../auth/useAuth";
import { cn } from "../lib/cn";
import { reducedMotion } from "../lib/animations";
import { Logo } from "./ui/logo";
import { ThemeToggle } from "./ui/themeToggle";
import { ButtonLink } from "./ui/button";
import { buttonStyles } from "./ui/styles";
import { CloseIcon, MenuIcon, SettingsIcon } from "./ui/icons";
import { LanguageToggle } from "./ui/languageToggle";
import { useI18n } from "../i18n/LanguageProvider";

/* Labels are dictionary keys — resolved through t() at render so the bar
   re-labels instantly when the language flips. */
const GUEST_LINKS = [
  { to: "/", label: "common.home" },
  { to: "/scan", label: "common.scan" },
  { to: "/pricing", label: "common.pricing" },
  { to: "/help", label: "common.help" },
  { to: "/contact", label: "common.contact" },
];

const MEMBER_LINKS = [
  { to: "/dashboard", label: "common.dashboard" },
  { to: "/scan", label: "common.scan" },
  { to: "/mybuildings", label: "common.buildings" },
  { to: "/new", label: "common.new" },
  { to: "/contact", label: "common.contact" },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "relative inline-flex min-h-11 items-center rounded-full px-3.5 text-[0.9375rem]",
    "transition-colors duration-200 ease-out",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    isActive
      ? "font-semibold text-ink"
      : "font-medium text-ink-muted hover:bg-surface-hover hover:text-ink",
  );

const Navbar = () => {
  const { t } = useI18n();
  const { status } = useAuth();
  const isLogged = status === "authed";
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);

  const location = useLocation();
  const headerRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const isClosingRef = useRef(false);

  const links = isLogged ? MEMBER_LINKS : GUEST_LINKS;

  // Close the drawer on navigation, otherwise it stays open over the new page.
  useEffect(() => {
    isClosingRef.current = false;
    setMenuOpen(false);
  }, [location.pathname]);

  /* --- Scroll behaviour ---------------------------------------------------
     `scrolled` deepens the glass once the page moves; `hidden` tucks the bar
     away while scrolling down and brings it back the moment the user scrolls
     up — content gets the full viewport, navigation stays one flick away. */
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      // Never hide near the top, while the drawer is open, or on tiny jitters.
      if (menuOpen || Math.abs(y - lastY) < 6) {
        lastY = y;
        return;
      }
      setHidden(y > lastY && y > 160);
      lastY = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [menuOpen]);

  /* --- Entrance (anime.js) ------------------------------------------------
     The pill drops in once on app load, then its items cascade. Runs on the
     inner bar so it never fights the hide/show transform on the header. */
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar || reducedMotion()) return;

    const scope: Scope = createScope({ root: bar }).add(() => {
      animate(bar, {
        translateY: [-72, 0],
        opacity: [0, 1],
        duration: 700,
        ease: "outQuint",
      });
      const items = bar.querySelectorAll<HTMLElement>("[data-nav-item]");
      if (items.length) {
        animate(items, {
          opacity: [0, 1],
          translateY: [-10, 0],
          duration: 500,
          delay: stagger(55, { start: 220 }),
          ease: "outQuint",
        });
      }
    });
    return () => scope.revert();
  }, []);

  /* --- Reading progress (anime.js scroll sync) ----------------------------
     A hairline brand gradient across the very top of the viewport whose width
     tracks how far down the page you are. */
  useLayoutEffect(() => {
    const el = progressRef.current;
    if (!el || reducedMotion()) return;

    const anim = animate(el, {
      scaleX: [0, 1],
      ease: "linear",
      autoplay: onScroll({
        container: document.documentElement,
        sync: true,
      }),
    });
    return () => {
      anim.cancel();
    };
  }, []);

  /* --- Drawer open (anime.js timeline) ------------------------------------ */
  useLayoutEffect(() => {
    if (!menuOpen || reducedMotion()) return;
    const drawer = drawerRef.current;
    const scrim = scrimRef.current;
    if (!drawer || !scrim) return;

    const items = drawer.querySelectorAll<HTMLElement>("[data-drawer-item]");
    const tl = createTimeline();
    tl.add(scrim, { opacity: [0, 1], duration: 220, ease: "linear" })
      .add(
        drawer,
        { translateX: ["-102%", "0%"], duration: 340, ease: "outQuint" },
        "<",
      )
      .add(
        items,
        {
          opacity: [0, 1],
          translateX: [-18, 0],
          duration: 380,
          delay: stagger(40),
          ease: "outQuint",
        },
        "-=200",
      );
    return () => {
      tl.cancel();
    };
  }, [menuOpen]);

  /** Animates the drawer out, then unmounts and returns focus. */
  const closeMenu = useCallback(() => {
    if (isClosingRef.current) return;
    const finish = () => {
      isClosingRef.current = false;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };

    const drawer = drawerRef.current;
    const scrim = scrimRef.current;
    if (reducedMotion() || !drawer || !scrim) {
      finish();
      return;
    }

    isClosingRef.current = true;
    const tl = createTimeline({ onComplete: finish });
    tl.add(drawer, { translateX: "-102%", duration: 260, ease: "inQuint" }).add(
      scrim,
      { opacity: 0, duration: 220, ease: "linear" },
      "<",
    );
  }, []);

  // Scroll lock + Escape while the drawer is open.
  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, closeMenu]);

  return (
    <>
      {/* Keyboard users can jump the nav instead of tabbing it on every page. */}
      <a
        href="#main"
        className={cn(
          "skip-link focus:translate-y-0",
          buttonStyles({ variant: "primary", size: "sm" }),
        )}
      >
        {t("nav.skipToContent")}
      </a>

      {/* Reading progress — outside the header so it stays visible even while
          the bar is tucked away. */}
      <div
        ref={progressRef}
        aria-hidden="true"
        style={{ transform: "scaleX(0)" }}
        className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-gradient-to-r from-brand-300 via-brand to-brand-600"
      />

      <header
        ref={headerRef}
        className={cn(
          "fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-5",
          "transition-transform duration-300 ease-out",
          hidden && "-translate-y-[130%]",
        )}
      >
        {/* Floating glass pill — visibly a surface even at the very top of the
            page, instead of dissolving into the hero. */}
        <nav
          ref={barRef}
          aria-label="Main"
          className={cn(
            "mx-auto flex w-full max-w-6xl items-center justify-between gap-3",
            "rounded-2xl border px-3 sm:px-4",
            "h-14 lg:h-16",
            "backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300",
            scrolled
              ? "border-line bg-canvas/90 shadow-md"
              : "border-line/70 bg-canvas/75 shadow-sm",
          )}
        >
          <span data-nav-item>
            <Link
              to="/"
              className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              aria-label="AlertUp — home"
            >
              <Logo size={30} />
            </Link>
          </span>

          {/* Desktop */}
          <ul className="hidden items-center gap-0.5 lg:flex">
            {links.map((link) => (
              <li key={link.to} data-nav-item>
                <NavLink to={link.to} end={link.to === "/"} className={navLinkClass}>
                  {({ isActive }) => (
                    <>
                      {t(link.label)}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute inset-x-3.5 bottom-1 h-0.5 rounded-full bg-brand",
                          "origin-center transition-transform duration-200 ease-out",
                          isActive ? "scale-x-100" : "scale-x-0",
                        )}
                      />
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <span data-nav-item>
              <LanguageToggle />
            </span>
            <span data-nav-item>
              <ThemeToggle />
            </span>

            {isLogged ? (
              <span data-nav-item className="hidden lg:block">
                <Link
                  to="/settings"
                  aria-label="Settings"
                  title="Settings"
                  className={cn(
                    "grid h-10 w-10 place-items-center rounded-full",
                    "border border-line bg-surface text-ink-muted",
                    "transition-colors duration-200 hover:bg-surface-hover hover:text-ink",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  )}
                >
                  <SettingsIcon size={19} />
                </Link>
              </span>
            ) : (
              <div className="hidden items-center gap-2 lg:flex">
                <span data-nav-item>
                  <ButtonLink to="/login" variant="ghost" size="sm">
                    {t("common.login")}
                  </ButtonLink>
                </span>
                <span data-nav-item>
                  <ButtonLink to="/register" variant="primary" size="sm">
                    {t("common.getStarted")}
                  </ButtonLink>
                </span>
              </div>
            )}

            <span data-nav-item className="lg:hidden">
              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-full",
                  "border border-line bg-surface text-ink",
                  "transition-colors duration-200 hover:bg-surface-hover",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                )}
              >
                <MenuIcon size={20} />
              </button>
            </span>
          </div>
        </nav>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Scrim: strong enough that the page behind stops competing. */}
          <button
            ref={scrimRef}
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={closeMenu}
            className="absolute inset-0 h-full w-full cursor-default bg-scrim"
          />

          <div
            ref={drawerRef}
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className={cn(
              "absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col",
              "border-r border-line bg-canvas shadow-xl",
            )}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <Logo size={30} />
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeMenu}
                aria-label="Close menu"
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-full",
                  "text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                )}
              >
                <CloseIcon size={20} />
              </button>
            </div>

            <ul className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
              {links.map((link) => (
                <li key={link.to} data-drawer-item>
                  <NavLink
                    to={link.to}
                    end={link.to === "/"}
                    className={({ isActive }) =>
                      cn(
                        "flex min-h-12 items-center rounded-xl px-4 text-base",
                        "transition-colors duration-200",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        isActive
                          ? "bg-brand-subtle font-semibold text-brand-text"
                          : "font-medium text-ink-muted hover:bg-surface-hover hover:text-ink",
                      )
                    }
                  >
                    {t(link.label)}
                  </NavLink>
                </li>
              ))}

              {isLogged && (
                <li data-drawer-item>
                  <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                      cn(
                        "flex min-h-12 items-center gap-3 rounded-xl px-4 text-base",
                        "transition-colors duration-200",
                        isActive
                          ? "bg-brand-subtle font-semibold text-brand-text"
                          : "font-medium text-ink-muted hover:bg-surface-hover hover:text-ink",
                      )
                    }
                  >
                    <SettingsIcon size={19} />
                    Settings
                  </NavLink>
                </li>
              )}
            </ul>

            {!isLogged && (
              <div
                data-drawer-item
                className="flex flex-col gap-2 border-t border-line p-4"
              >
                <ButtonLink to="/register" variant="primary" fullWidth>
                  {t("common.getStarted")}
                </ButtonLink>
                <ButtonLink to="/login" variant="secondary" fullWidth>
                  {t("common.login")}
                </ButtonLink>
              </div>
            )}

            <p className="border-t border-line px-5 py-4 text-xs text-ink-subtle">
              AlertUp © {new Date().getFullYear()}
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
