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
import { useAuth } from "../../auth/useAuth";
import { logoutFromAccount } from "../../apis/settings";
import { cn } from "../../lib/cn";
import { reducedMotion } from "../../lib/animations";
import { Logo } from "../ui/logo";
import { ThemeToggle } from "../ui/themeToggle";
import { ButtonLink } from "../ui/button";
import { buttonStyles } from "../ui/styles";
import {
  BuildingIcon,
  ChartIcon,
  CloseIcon,
  LogOutIcon,
  MenuIcon,
  PlusIcon,
  ScanIcon,
  SettingsIcon,
} from "../ui/icons";
import { useI18n } from "../../i18n/LanguageProvider";

/* ============================================================================
   Navbar
   ----------------------------------------------------------------------------
   Full-bleed bar. On desktop every destination is a visible button — no
   hamburger, because hiding navigation behind a menu on a screen with room to
   spare just adds a click. The hamburger appears only below `lg`, where there
   genuinely isn't room.

   Between three and five links, and no more. Language lives in Settings, not
   here: it is a preference you set once, not somewhere you navigate to.
   ========================================================================= */

type NavItem = { to: string; label: string; end?: boolean };

/** Guests: 4 links + Log in + Get started. */
const GUEST_LINKS: NavItem[] = [
  { to: "/", label: "common.home", end: true },
  { to: "/scan", label: "common.scan" },
  { to: "/pricing", label: "common.pricing" },
  { to: "/help", label: "common.help" },
];

/** Members: 4 links + the account menu. */
const MEMBER_LINKS: NavItem[] = [
  { to: "/dashboard", label: "common.dashboard" },
  { to: "/mybuildings", label: "common.buildings" },
  { to: "/scan", label: "common.scan" },
  { to: "/pricing", label: "common.pricing" },
];

/** Account dropdown (desktop) and the tail of the mobile drawer. */
const ACCOUNT_LINKS: Array<NavItem & { icon: typeof ScanIcon }> = [
  { to: "/dashboard", label: "common.dashboard", icon: ChartIcon },
  { to: "/mybuildings", label: "nav.myBuildings", icon: BuildingIcon },
  { to: "/new", label: "nav.addBuilding", icon: PlusIcon },
  { to: "/settings", label: "common.settings", icon: SettingsIcon },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "relative inline-flex min-h-10 items-center rounded-lg px-3 text-[0.9375rem]",
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

const menuItemClass = cn(
  "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm",
  "text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
);

const Navbar = () => {
  const { t } = useI18n();
  const { status, user, refresh } = useAuth();
  const isLogged = status === "authed";
  const navigate = useNavigate();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const location = useLocation();
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

  // Close both overlays on navigation.
  useEffect(() => {
    isClosingRef.current = false;
    setDrawerOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  /* A full-bleed bar needs a boundary once the page moves under it, otherwise
     content slides beneath a floating row of text with nothing separating them. */
  useEffect(() => {
    const onScrollHandler = () => setScrolled(window.scrollY > 4);
    onScrollHandler();
    window.addEventListener("scroll", onScrollHandler, { passive: true });
    return () => window.removeEventListener("scroll", onScrollHandler);
  }, []);

  /* Entrance — items cascade in once on load. */
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar || reducedMotion()) return;

    const scope: Scope = createScope({ root: bar }).add(() => {
      const items = bar.querySelectorAll<HTMLElement>("[data-nav-item]");
      if (items.length) {
        animate(items, {
          opacity: [0, 1],
          translateY: [-8, 0],
          duration: 460,
          delay: stagger(45, { start: 120 }),
          ease: "outQuint",
        });
      }
    });
    return () => scope.revert();
  }, []);

  /* Reading progress — a hairline whose width tracks scroll depth. */
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

  /* Account dropdown: outside pointerdown and Escape close it, and focus goes
     back to the trigger so keyboard users are not dropped at the document top. */
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

  /* Mobile drawer */
  useLayoutEffect(() => {
    if (!drawerOpen || reducedMotion()) return;
    const drawer = drawerRef.current;
    const scrim = scrimRef.current;
    if (!drawer || !scrim) return;

    const items = drawer.querySelectorAll<HTMLElement>("[data-drawer-item]");
    const tl = createTimeline();
    tl.add(scrim, { opacity: [0, 1], duration: 200, ease: "linear" })
      .add(
        drawer,
        { translateX: ["102%", "0%"], duration: 320, ease: "outQuint" },
        "<",
      )
      .add(
        items,
        {
          opacity: [0, 1],
          translateX: [16, 0],
          duration: 340,
          delay: stagger(38),
          ease: "outQuint",
        },
        "-=180",
      );
    return () => {
      tl.cancel();
    };
  }, [drawerOpen]);

  const closeDrawer = useCallback(() => {
    if (isClosingRef.current) return;
    const finish = () => {
      isClosingRef.current = false;
      setDrawerOpen(false);
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
    tl.add(drawer, { translateX: "102%", duration: 240, ease: "inQuint" }).add(
      scrim,
      { opacity: 0, duration: 200, ease: "linear" },
      "<",
    );
  }, []);

  // Scroll lock + Escape while the drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen, closeDrawer]);

  const handleLogout = useCallback(async () => {
    setAccountOpen(false);
    setDrawerOpen(false);
    try {
      await logoutFromAccount();
    } catch {
      // Best effort server-side; the local session is dropped either way.
    }
    await refresh();
    navigate("/", { replace: true });
  }, [refresh, navigate]);

  return (
    <>
      <a
        href="#main"
        className={cn(
          "skip-link focus:translate-y-0",
          buttonStyles({ variant: "primary", size: "sm" }),
        )}
      >
        {t("nav.skipToContent")}
      </a>

      <div
        ref={progressRef}
        aria-hidden="true"
        style={{ transform: "scaleX(0)" }}
        className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-brand"
      />

      {/* Full-bleed: the bar spans the viewport; only its contents are inset. */}
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 border-b bg-canvas/85 backdrop-blur-xl",
          "transition-[background-color,border-color,box-shadow] duration-300",
          scrolled ? "border-line shadow-sm" : "border-transparent",
        )}
      >
        <nav
          ref={barRef}
          aria-label={t("nav.mainLabel")}
          className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8"
        >
          <span data-nav-item className="shrink-0">
            <Link
              to="/"
              className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              aria-label={t("nav.homeAria")}
            >
              <Logo size={30} />
            </Link>
          </span>

          {/* Desktop: every destination visible. No hamburger at this width. */}
          <ul className="ml-2 hidden items-center gap-1 lg:flex">
            {links.map((link) => (
              <li key={link.to} data-nav-item>
                <NavLink to={link.to} end={link.end} className={navLinkClass}>
                  {({ isActive }) => (
                    <>
                      {t(link.label)}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute inset-x-3 bottom-0.5 h-0.5 rounded-full bg-brand",
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

          <div className="ml-auto flex items-center gap-2">
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
                    "bg-brand text-sm font-semibold text-brand-ink",
                    "transition-opacity duration-200 hover:opacity-90",
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
                            className={menuItemClass}
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
                          menuItemClass,
                          "text-danger-text hover:bg-danger-subtle hover:text-danger-text",
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
                    {t("common.register")}
                  </ButtonLink>
                </span>
              </div>
            )}

            {/* Hamburger: below lg only. */}
            <span data-nav-item className="lg:hidden">
              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label={t("nav.openMenu")}
                aria-expanded={drawerOpen}
                aria-controls="mobile-menu"
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-lg",
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
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            ref={scrimRef}
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={closeDrawer}
            className="absolute inset-0 h-full w-full cursor-default bg-scrim"
          />

          <div
            ref={drawerRef}
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.menuLabel")}
            className={cn(
              "absolute inset-y-0 right-0 flex w-[min(20rem,85vw)] flex-col",
              "border-l border-line bg-canvas shadow-xl",
            )}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <Logo size={28} />
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeDrawer}
                aria-label={t("nav.closeMenu")}
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-lg",
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

            <div className="flex items-center justify-end border-t border-line px-4 py-3 sm:hidden">
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
                  {t("common.register")}
                </ButtonLink>
                <ButtonLink to="/login" variant="secondary" fullWidth>
                  {t("common.login")}
                </ButtonLink>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
