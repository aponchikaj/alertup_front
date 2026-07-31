import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/LanguageProvider";
import { usePageAnimations } from "../../lib/animations";
import { cn } from "../../lib/cn";
import { Container, Section } from "../../components/ui/layout";
import { ButtonLink } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Badge } from "../../components/ui/feedback";
import type { ButtonVariant } from "../../components/ui/styles";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  StarIcon,
} from "../../components/ui/icons";

interface Tier {
  id: string;
  nameKey: string;
  descKey: string;
  priceKey: string;
  /** Numeric prices get the "/month" suffix; "Let's talk" does not. */
  recurring: boolean;
  featureKeys: readonly string[];
  ctaKey: string;
  ctaTo: string;
  ctaVariant: ButtonVariant;
  /** Extra line under the CTA — only Enterprise has one. */
  noteKey?: string;
  featured?: boolean;
}

const TIERS: readonly Tier[] = [
  {
    id: "free",
    nameKey: "pricing.freeName",
    descKey: "pricing.freeDesc",
    priceKey: "pricing.freePrice",
    recurring: false,
    featureKeys: [
      "pricing.freeFeat1",
      "pricing.freeFeat2",
      "pricing.freeFeat3",
      "pricing.freeFeat4",
    ],
    ctaKey: "pricing.freeCta",
    ctaTo: "/register",
    ctaVariant: "secondary",
  },
  {
    id: "starter",
    nameKey: "pricing.starterName",
    descKey: "pricing.starterDesc",
    priceKey: "pricing.starterPrice",
    recurring: true,
    featureKeys: [
      "pricing.starterFeat1",
      "pricing.starterFeat2",
      "pricing.starterFeat3",
      "pricing.starterFeat4",
    ],
    ctaKey: "pricing.starterCta",
    ctaTo: "/register",
    ctaVariant: "secondary",
  },
  {
    id: "business",
    nameKey: "pricing.businessName",
    descKey: "pricing.businessDesc",
    priceKey: "pricing.businessPrice",
    recurring: true,
    featureKeys: [
      "pricing.businessFeat1",
      "pricing.businessFeat2",
      "pricing.businessFeat3",
      "pricing.businessFeat4",
      "pricing.businessFeat5",
    ],
    ctaKey: "pricing.businessCta",
    ctaTo: "/register",
    ctaVariant: "primary",
    featured: true,
  },
  {
    id: "enterprise",
    nameKey: "pricing.enterpriseName",
    descKey: "pricing.enterpriseDesc",
    priceKey: "pricing.enterprisePrice",
    recurring: false,
    featureKeys: [
      "pricing.enterpriseFeat1",
      "pricing.enterpriseFeat2",
      "pricing.enterpriseFeat3",
      "pricing.enterpriseFeat4",
      "pricing.enterpriseFeat5",
    ],
    ctaKey: "pricing.enterpriseCta",
    // The contact page reads ?plan=enterprise and prefills the reason field.
    ctaTo: "/contact?plan=enterprise",
    ctaVariant: "secondary",
    noteKey: "pricing.enterpriseNote",
  },
];

const Pricing = () => {
  const rootRef = usePageAnimations();
  const { t } = useI18n();

  return (
    <div ref={rootRef}>
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden bg-canvas">
        <div
          className="bg-grid pointer-events-none absolute inset-0"
          aria-hidden="true"
        />
        <Container className="relative flex flex-col items-center gap-4 pb-14 pt-28 text-center sm:pt-32 lg:pb-16 lg:pt-36">
          <span
            data-hero
            className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-text"
          >
            {t("pricing.eyebrow")}
          </span>
          {/* The page's only <h1>. */}
          <h1
            data-hero
            className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl"
          >
            {t("pricing.title")}
          </h1>
          <p
            data-hero
            className="max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg"
          >
            {t("pricing.lead")}
          </p>
        </Container>
      </section>

      {/* ================= PLANS ================= */}
      <Section tone="subtle" aria-label={t("pricing.eyebrow")}>
        <Container width="wide" className="flex flex-col gap-10">
          <div
            data-reveal-group
            className="grid w-full items-stretch gap-6 sm:grid-cols-2 xl:grid-cols-4"
          >
            {TIERS.map((tier) => (
              <div key={tier.id} data-reveal-item className="h-full">
                <Card
                  className={cn(
                    "flex h-full flex-col gap-6 p-7",
                    tier.featured &&
                      "border-brand-border shadow-lg ring-1 ring-brand-border",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1.5">
                      <h2 className="text-lg font-semibold text-ink">
                        {t(tier.nameKey)}
                      </h2>
                      <p className="text-sm text-ink-muted">{t(tier.descKey)}</p>
                    </div>
                    {tier.featured && (
                      <Badge tone="brand" className="shrink-0">
                        <StarIcon size={13} />
                        {t("pricing.mostPopular")}
                      </Badge>
                    )}
                  </div>

                  <p className="flex flex-wrap items-baseline gap-1">
                    <span
                      className={cn(
                        "font-semibold tracking-tight text-ink",
                        tier.recurring || tier.id === "free"
                          ? "text-4xl"
                          : "text-3xl",
                      )}
                    >
                      {t(tier.priceKey)}
                    </span>
                    {tier.recurring && (
                      <span className="text-sm text-ink-subtle">
                        {t("pricing.perMonth")}
                      </span>
                    )}
                  </p>

                  <ul className="flex flex-1 flex-col gap-3 border-t border-line pt-6">
                    {tier.featureKeys.map((key) => (
                      <li
                        key={key}
                        className="flex items-start gap-2.5 text-[0.9375rem] text-ink-muted"
                      >
                        <CheckCircleIcon
                          size={19}
                          className="mt-0.5 shrink-0 text-success-text"
                        />
                        {t(key)}
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-col gap-2.5">
                    <ButtonLink
                      to={tier.ctaTo}
                      variant={tier.ctaVariant}
                      fullWidth
                    >
                      {t(tier.ctaKey)}
                      {tier.featured && <ArrowRightIcon size={18} />}
                    </ButtonLink>
                    {tier.noteKey && (
                      <p className="text-center text-xs leading-relaxed text-ink-subtle">
                        {t(tier.noteKey)}
                      </p>
                    )}
                  </div>
                </Card>
              </div>
            ))}
          </div>

          {/* --- Footnote --- */}
          <div
            data-reveal
            className="flex flex-col items-center gap-1.5 text-center"
          >
            <p className="text-sm text-ink-subtle">{t("pricing.faqNote")}</p>
            <Link
              to="/contact"
              className="rounded-sm text-sm font-semibold text-brand-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {t("pricing.contactSales")}
            </Link>
          </div>
        </Container>
      </Section>
    </div>
  );
};

export default Pricing;
