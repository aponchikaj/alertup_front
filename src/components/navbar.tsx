import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  animate,
  createScope,
  createTimeline,
  onScroll,
  stagger,
  type Scope,
} from "animejs";
import { useAuth } from "../auth/useAuth";
import { logoutFromAccount } from "../apis/settings";
import { cn } from "../lib/cn";
import { reducedMotion } from "../lib/animations";
import { Logo } from "./ui/logo";
import { ThemeToggle } from "./ui/themeToggle";
import { ButtonLink } from "./ui/button";
import { buttonStyles } from "./ui/styles";
import {
  BuildingIcon,
  ChartIcon,
  CloseIcon,
  LogOutIcon,
  MenuIcon,
  PlusIcon,
  ScanIcon,
  SettingsIcon,
  UserIcon,
} from "./ui/icons";
import { LanguageToggle } from "./ui/languageToggle";
import { useI18n } from "../i18n/LanguageProvider";

/* ============================================================================
   Navbar
   ----------------------------------------------------------------------------
   A floating glass pill that tucks away while you scroll down and returns the
   moment you scroll up. Three things it must get right:

   1. Scanning is the primary visitor action, so it is a button, not a link
      buried among the others.
   2. A signed-in person needs somewhere to go and a way out — the account menu
      carries dashboard/buildings/settings and, finally, log out (there was no
      way to sign out from the bar at all before).
   3. Every string is translatable, including the accessible names, which were
      the last hardcoded English left in this component.
   ========================================================================= */

type NavItem = { to: string; label: string; end?: boolean };

const GUEST_LINKS: NavItem[] = [
  { to: "/", label: "common.home", end: true },
  { to: "/pricing", label: "common.pricing" },
  { to: "/help", label: "common.help" },
  { to: "/contact", label: "common.contact" },
];

const MEMBER_LINKS: NavItem[] = [
  { to: "/dashboard", label: "common.dashboard" },
  { to: "/mybuildings", label: "common.buildings" },
  { to: "/pricing", label: "common.pricing" },
  { to: "/help", label: "common.help" },
];

/** Items inside the account dropdown (desktop) and the drawer's account block. */
const ACCOUNT_LINKS: Array<NavItem & { icon: typeof UserIcon }> = [
  { to: "/dashboard", label: "common.dashboard", icon: ChartIcon },
  { to: "/mybuildings", label: "nav.myBuildings", icon: BuildingIcon },
  { to: "/new", label: "nav.addBuilding", icon: PlusIcon },
  { to: "/settings", label: "common.settings", icon: SettingsIcon },
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

const drawerLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex min-h-12 items-center gap-3 rounded-xl px-4 text-base",
    "transition-colors duration-200",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    isActive
      ? "bg-brand-subtle font-semibold text-brand-text"
      : "font-medium text-ink-muted hover:bg-surface-hover hover:text-ink",
  );

const iconButtonClass = cn(
  "grid h-10 w-10 place-items-center rounded-full",
  "border border-line bg-surface text-ink-muted",
  "transition-colors duration-200 hover:bg-surface-hover hover:text-ink",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
);

const Navbar = () => {
  const { t } = useI18n();
  const { status, user, refresh } = useAuth();
  const isLogged = status === "authed";
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
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
  const accountRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const isClosingRef = useRef(false);

  const links = isLogged ? MEMBER_LINKS : GUEST_LINKS;

  const accountName = useMemo(() => {
    if (!user) return "";
    const parts = [user.name, user.lastname].filter(
      (part): part is string => typeof part === "string" && part.length > 0,
    );
    if (parts.length) return parts.join(" ");
    if (typeof user.company === "string" && user.company) return user.company;
    return typeof user.email === "string" ? user.email : "";
  }, [user]);

  const accountInitial = accountName.trim().charAt(0).toUpperCase() || "?";

  // Close both overlays on navigation, otherwise they hang over the new page.
  useEffect(() => {
    isClosingRef.current = false;
    setMenuOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  /* --- Scroll behaviour ---------------------------------------------------
     `scrolled` deepens the glass once the page moves; `hidden` tucks the bar
     away while scrolling down and brings it back the moment the user scrolls
     up — content gets the full viewport, navigation stays one flick away. */
  useEffect(() => {
    let lastY = window.scrollY;
    const onScrollHandler = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      // Never hide near the top, while an overlay is open, or on tiny jitters.
      if (menuOpen || accountOpen || Math.abs(y - lastY) < 6) {
        lastY = y;
        return;
      }
      setHidden(y > lastY && y > 160);
      lastY = y;
    };
    onScrollHandler();
    window.addEventListener("scroll", onScrollHandler, { passive: true });
    return () => window.removeEventListener("scroll", onScrollHandler);
  }, [menuOpen, accountOpen]);

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

  /* --- Reading progress (anime.js scroll sync) ---------------------------- */
  useLayoutEffect(() => {
    const el = progressRef.current;
    if (!el || reducedMotion()) return;

    const anim = animate(el, {
      scaleX: [0, 1],
      ease: "linear",
      autoplay: onScroll({ container: document.documentElement, sync: true }),
    });
    return () => {
      anim.cancel();
    };
  }, []);

  /* --- Account dropdown ---------------------------------------------------
     Closes on outside pointerdown and on Escape, and returns focus to its
     trigger so keyboard users are not dropped at the top of the document. */
  useEffect(() => {
    if (!accountOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!accountRef.current?.contains(e.target as Node)) setAccountOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAccountOpen(false);
      accountButtonRef.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen]);

  useLayoutEffect(() => {
    const panel = accountRef.current?.querySelector<HTMLElement>("[data-account-panel]");
    if (!accountOpen || !panel || reducedMotion()) return;
    animate(panel, {
      opacity: [0, 1],
      translateY: [-8, 0],
      scale: [0.97, 1],
      duration: 200,
      ease: "outQuint",
    });
  }, [accountOpen]);

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

  /** Sign out, then refresh the auth context so guards re-evaluate. */
  const handleLogout = useCallback(async () => {
    setAccountOpen(false);
    setMenuOpen(false);
    try {
      await logoutFromAccount();
    } catch {
      // The cookie is cleared server-side on a best-effort basis; either way
      // the local session is dropped below.
    }
    await refresh();
    navigate("/", { replace: true });
  }, [refresh, navigate]);

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
        <nav
          ref={barRef}
          aria-label={t("nav.mainLabel")}
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
              aria-label={t("nav.homeAria")}
            >
              <Logo size={30} />
            </Link>
          </span>

          {/* Desktop links */}
          <ul className="hidden items-center gap-0.5 lg:flex">
            {links.map((link) => (
              <li key={link.to} data-nav-item>
                <NavLink to={link.to} end={link.end} className={navLinkClass}>
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
            {/* Scanning is the primary visitor action — it gets a button, not a
                link lost among the others. Icon-only on small screens. */}
            <span data-nav-item className="hidden sm:block">
              <ButtonLink to="/scan" variant="secondary" size="sm">
                <ScanIcon size={17} aria-hidden="true" />
                {t("nav.scanCta")}
              </ButtonLink>
            </span>
            <span data-nav-item className="sm:hidden">
              <Link to="/scan" aria-label={t("nav.scanCta")} className={iconButtonClass}>
                <ScanIcon size={19} />
              </Link>
            </span>

            <span data-nav-item className="hidden sm:block">
              <LanguageToggle />
            </span>
            <span data-nav-item className="hidden sm:block">
              <ThemeToggle />
            </span>

            {isLogged ? (
              <div ref={accountRef} data-nav-item className="relative hidden lg:block">
                <button
                  ref={accountButtonRef}
                  type="button"
                  onClick={() => setAccountOpen((open) => !open)}
                  aria-label={t("nav.accountMenu")}
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                  className={cn(
                    "grid h-10 w-10 place-items-center rounded-full",
                    "border border-line bg-brand text-sm font-semibold text-brand-ink",
                    "transition-transform duration-200 hover:scale-105",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  )}
                >
                  <span aria-hidden="true">{accountInitial}</span>
                </button>

                {accountOpen && (
                  <div
                    data-account-panel
                    role="menu"
                    aria-label={t("nav.accountMenu")}
                    className={cn(
                      "absolute right-0 top-full z-50 mt-2 w-64 origin-top-right",
                      "overflow-hidden rounded-2xl border border-line bg-surface shadow-xl",
                    )}
                  >
                    <div className="border-b border-line px-4 py-3">
                      <p className="truncate text-sm font-semibold text-ink">
                        {accountName}
                      </p>
                      {typeof user?.email === "string" && user.email !== accountName ? (
                        <p className="truncate text-xs text-ink-subtle">{user.email}</p>
                      ) : null}
                    </div>

                    <ul className="p-1.5">
                      {ACCOUNT_LINKS.map(({ to, label, icon: Icon }) => (
                        <li key={to}>
                          <Link
                            to={to}
                            role="menuitem"
                            onClick={() => setAccountOpen(false)}
                            className={cn(
                              "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm",
                              "text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink",
                              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                            )}
                          >
                            <Icon size={17} aria-hidden="true" />
                            {t(label)}
                          </Link>
                        </li>
                      ))}
                    </ul>

                    <div className="border-t border-line p-1.5">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleLogout}
                        className={cn(
                          "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm",
                          "text-danger-text transition-colors hover:bg-danger-subtle",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        )}
                      >
                        <LogOutIcon size={17} aria-hidden="true" />
                        {t("common.logout")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
                aria-label={t("nav.openMenu")}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                className={cn(iconButtonClass, "text-ink")}
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
            aria-label={t("nav.menuLabel")}
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
                aria-label={t("nav.closeMenu")}
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-full",
                  "text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                )}
              >
                <CloseIcon size={20} />
              </button>
            </div>

            {isLogged && accountName ? (
              <div
                data-drawer-item
                className="flex items-center gap-3 border-b border-line px-5 py-4"
              >
                <span
                  aria-hidden="true"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-brand-ink"
                >
                  {accountInitial}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {accountName}
                  </span>
                  {typeof user?.email === "string" && user.email !== accountName ? (
                    <span className="block truncate text-xs text-ink-subtle">
                      {user.email}
                    </span>
                  ) : null}
                </span>
              </div>
            ) : null}

            <ul className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
              <li data-drawer-item>
                <NavLink to="/scan" className={drawerLinkClass}>
                  <ScanIcon size={19} aria-hidden="true" />
                  {t("nav.scanCta")}
                </NavLink>
              </li>

              {links.map((link) => (
                <li key={link.to} data-drawer-item>
                  <NavLink to={link.to} end={link.end} className={drawerLinkClass}>
                    {t(link.label)}
                  </NavLink>
                </li>
              ))}

              {isLogged &&
                ACCOUNT_LINKS.filter(
                  (item) => !links.some((link) => link.to === item.to),
                ).map(({ to, label, icon: Icon }) => (
                  <li key={to} data-drawer-item>
                    <NavLink to={to} className={drawerLinkClass}>
                      <Icon size={19} aria-hidden="true" />
                      {t(label)}
                    </NavLink>
                  </li>
                ))}
            </ul>

            <div className="flex items-center gap-2 border-t border-line px-4 py-3 sm:hidden">
              <LanguageToggle />
              <ThemeToggle />
            </div>

            {isLogged ? (
              <div data-drawer-item className="border-t border-line p-4">
                <button
                  type="button"
                  onClick={handleLogout}
                  className={cn(
                    "flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-base font-medium",
                    "text-danger-text transition-colors hover:bg-danger-subtle",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  )}
                >
                  <LogOutIcon size={19} aria-hidden="true" />
                  {t("common.logout")}
                </button>
              </div>
            ) : (
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
              {t("footer.builtIn", { year: new Date().getFullYear() })}
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
