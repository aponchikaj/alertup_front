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
} from "./ui/icons";
import { LanguageToggle } from "./ui/languageToggle";
import { useI18n } from "../i18n/LanguageProvider";

/* ============================================================================
   Navbar
   ----------------------------------------------------------------------------
   Deliberately sparse. The bar holds four things at most — logo, a couple of
   links, one action, one menu — because a navigation bar competing with the
   page for attention is a navigation bar people stop reading.

   Everything that is a *setting* rather than a *destination* (theme, language)
   lives in the menu. Scanning lives there too: visitors reach a scan page from
   a printed code, not from this bar, so it does not earn a permanent slot.
   ========================================================================= */

type NavItem = { to: string; label: string; end?: boolean };

/** Two links each. Anything more and nothing stands out. */
const GUEST_LINKS: NavItem[] = [
  { to: "/pricing", label: "common.pricing" },
  { to: "/help", label: "common.help" },
];

const MEMBER_LINKS: NavItem[] = [
  { to: "/dashboard", label: "common.dashboard" },
  { to: "/mybuildings", label: "common.buildings" },
];

const MENU_LINKS: Array<NavItem & { icon: typeof ScanIcon }> = [
  { to: "/scan", label: "nav.scanCta", icon: ScanIcon },
  { to: "/dashboard", label: "common.dashboard", icon: ChartIcon },
  { to: "/mybuildings", label: "nav.myBuildings", icon: BuildingIcon },
  { to: "/new", label: "nav.addBuilding", icon: PlusIcon },
  { to: "/settings", label: "common.settings", icon: SettingsIcon },
];

const GUEST_MENU_LINKS: Array<NavItem & { icon: typeof ScanIcon }> = [
  { to: "/scan", label: "nav.scanCta", icon: ScanIcon },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "relative inline-flex min-h-11 items-center rounded-full px-3.5 text-[0.9375rem]",
    "transition-colors duration-200 ease-out",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    isActive
      ? "font-semibold text-ink"
      : "font-medium text-ink-muted hover:text-ink",
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

  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);

  const location = useLocation();
  const barRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const links = isLogged ? MEMBER_LINKS : GUEST_LINKS;
  const menuLinks = isLogged ? MENU_LINKS : GUEST_MENU_LINKS;

  const accountName = useMemo(() => {
    if (!user) return "";
    const parts = [user.name, user.lastname].filter(
      (part): part is string => typeof part === "string" && part.length > 0,
    );
    if (parts.length) return parts.join(" ");
    if (typeof user.company === "string" && user.company) return user.company;
    return typeof user.email === "string" ? user.email : "";
  }, [user]);

  // Close on navigation, otherwise the panel hangs over the new page.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  /* Scroll: deepen the glass once the page moves, and tuck the bar away while
     scrolling down so content gets the full viewport. */
  useEffect(() => {
    let lastY = window.scrollY;
    const onScrollHandler = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      if (menuOpen || Math.abs(y - lastY) < 6) {
        lastY = y;
        return;
      }
      setHidden(y > lastY && y > 160);
      lastY = y;
    };
    onScrollHandler();
    window.addEventListener("scroll", onScrollHandler, { passive: true });
    return () => window.removeEventListener("scroll", onScrollHandler);
  }, [menuOpen]);

  /* Entrance — the pill drops in once, then its items cascade. */
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

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  /* One panel for every breakpoint: a dropdown beside the trigger on desktop,
     a sheet from the bottom on phones. Same content, same code path. */
  useLayoutEffect(() => {
    if (!menuOpen || reducedMotion()) return;
    const panel = panelRef.current;
    if (!panel) return;

    const items = panel.querySelectorAll<HTMLElement>("[data-menu-item]");
    const tl = createTimeline();
    tl.add(panel, {
      opacity: [0, 1],
      translateY: [-8, 0],
      scale: [0.98, 1],
      duration: 240,
      ease: "outQuint",
    }).add(
      items,
      {
        opacity: [0, 1],
        translateY: [-6, 0],
        duration: 260,
        delay: stagger(28),
        ease: "outQuint",
      },
      "-=160",
    );
    return () => {
      tl.cancel();
    };
  }, [menuOpen]);

  // Outside click, Escape, and scroll lock while the panel is open.
  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (menuButtonRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, closeMenu]);

  const handleLogout = useCallback(async () => {
    setMenuOpen(false);
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

      <header
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
            "mx-auto flex w-full max-w-5xl items-center justify-between gap-4",
            "rounded-2xl border px-3 sm:px-4",
            "h-14",
            "backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300",
            scrolled
              ? "border-line bg-canvas/90 shadow-sm"
              : "border-transparent bg-canvas/70",
          )}
        >
          <span data-nav-item>
            <Link
              to="/"
              className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              aria-label={t("nav.homeAria")}
            >
              <Logo size={28} />
            </Link>
          </span>

          {/* Two links. Anything more and nothing stands out. */}
          <ul className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <li key={link.to} data-nav-item>
                <NavLink to={link.to} end={link.end} className={navLinkClass}>
                  {t(link.label)}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            {!isLogged && (
              <span data-nav-item className="hidden sm:block">
                <ButtonLink to="/register" variant="primary" size="sm">
                  {t("common.getStarted")}
                </ButtonLink>
              </span>
            )}

            <span data-nav-item className="relative">
              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label={isLogged ? t("nav.accountMenu") : t("nav.openMenu")}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-full transition-colors duration-200",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  isLogged
                    ? "bg-brand text-sm font-semibold text-brand-ink hover:opacity-90"
                    : "border border-line bg-surface text-ink hover:bg-surface-hover",
                )}
              >
                {isLogged ? (
                  <span aria-hidden="true">
                    {accountName.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                ) : menuOpen ? (
                  <CloseIcon size={19} />
                ) : (
                  <MenuIcon size={19} />
                )}
              </button>

              {menuOpen && (
                <>
                  {/* Phone: a scrim so the panel reads as a layer, not a tooltip. */}
                  <div
                    aria-hidden="true"
                    className="fixed inset-0 z-40 bg-scrim sm:hidden"
                  />
                  <div
                    ref={panelRef}
                    role="menu"
                    aria-label={t("nav.menuLabel")}
                    className={cn(
                      "z-50 overflow-hidden border border-line bg-surface shadow-xl",
                      // Phone: bottom sheet. Desktop: dropdown under the trigger.
                      "fixed inset-x-3 bottom-3 rounded-2xl",
                      "sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-60 sm:origin-top-right",
                    )}
                  >
                    {isLogged && accountName ? (
                      <div
                        data-menu-item
                        className="border-b border-line px-4 py-3"
                      >
                        <p className="truncate text-sm font-semibold text-ink">
                          {accountName}
                        </p>
                        {typeof user?.email === "string" &&
                        user.email !== accountName ? (
                          <p className="truncate text-xs text-ink-subtle">
                            {user.email}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <ul className="p-1.5">
                      {menuLinks.map(({ to, label, icon: Icon }) => (
                        <li key={to} data-menu-item>
                          <Link
                            to={to}
                            role="menuitem"
                            onClick={() => setMenuOpen(false)}
                            className={menuItemClass}
                          >
                            <Icon size={17} aria-hidden="true" />
                            {t(label)}
                          </Link>
                        </li>
                      ))}

                      {/* The two links from the bar, for widths that hide them. */}
                      {links.map((link) => (
                        <li key={link.to} data-menu-item className="md:hidden">
                          <Link
                            to={link.to}
                            role="menuitem"
                            onClick={() => setMenuOpen(false)}
                            className={menuItemClass}
                          >
                            <span className="w-[17px]" aria-hidden="true" />
                            {t(link.label)}
                          </Link>
                        </li>
                      ))}
                    </ul>

                    {/* Settings, not destinations — they belong here, not in the bar. */}
                    <div
                      data-menu-item
                      className="flex items-center justify-between gap-2 border-t border-line px-3 py-2.5"
                    >
                      <LanguageToggle />
                      <ThemeToggle />
                    </div>

                    <div data-menu-item className="border-t border-line p-1.5">
                      {isLogged ? (
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
                      ) : (
                        <div className="flex flex-col gap-1.5 p-1.5">
                          <ButtonLink to="/register" variant="primary" fullWidth>
                            {t("common.getStarted")}
                          </ButtonLink>
                          <ButtonLink to="/login" variant="secondary" fullWidth>
                            {t("common.login")}
                          </ButtonLink>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </span>
          </div>
        </nav>
      </header>
    </>
  );
};

export default Navbar;
