import { Link } from "react-router-dom";
import { Container } from "../ui/layout";
import { Logo } from "../ui/logo";
import Sponsors from "../marketing/Sponsors";
import { useI18n } from "../../i18n/LanguageProvider";

const footerLinkClass =
  "inline-block py-1.5 text-sm text-ink-muted transition-colors hover:text-brand-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-sm";

const Footer = () => {
  const { t } = useI18n();

  // Built inside the component: every heading and label is translated, so this
  // cannot be hoisted to a module-level constant evaluated before a language
  // is known.
  const linkGroups: { heading: string; links: { to: string; label: string }[] }[] = [
    {
      heading: t("footer.product"),
      links: [
        { to: "/", label: t("common.home") },
        { to: "/scan", label: t("footer.scanACode") },
        { to: "/new", label: t("footer.addBuilding") },
        { to: "/mybuildings", label: t("footer.myBuildings") },
        { to: "/pricing", label: t("footer.pricing") },
      ],
    },
    {
      heading: t("footer.support"),
      links: [
        { to: "/help", label: t("footer.help") },
        { to: "/contact", label: t("footer.contactUs") },
        { to: "/security", label: t("footer.security") },
        { to: "/accessibility", label: t("footer.accessibility") },
      ],
    },
    {
      heading: t("footer.legal"),
      links: [
        { to: "/privacy", label: t("footer.privacyPolicy") },
        { to: "/terms", label: t("footer.termsOfService") },
        { to: "/cookies", label: t("footer.cookiePolicy") },
      ],
    },
  ];

  return (
    <footer className="border-t border-line bg-canvas-subtle">
      <Container className="py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="flex flex-col gap-4">
            <Logo size={34} />
            <p className="max-w-xs text-sm leading-relaxed text-ink-muted">
              {t("footer.tagline")}
            </p>
            <Sponsors />
          </div>

          {linkGroups.map((group) => (
            <nav key={group.heading} aria-label={group.heading}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink">
                {group.heading}
              </h2>
              <ul>
                {group.links.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className={footerLinkClass}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-subtle">
            {t("footer.builtIn", { year: new Date().getFullYear() })}
          </p>
          <p className="max-w-md text-xs leading-relaxed text-ink-subtle">
            {t("footer.disclaimer")}
          </p>
        </div>
      </Container>
    </footer>
  );
};

export default Footer;
