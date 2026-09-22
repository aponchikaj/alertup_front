import { Link } from "react-router-dom";
import ProductAiWidget from "../../components/ai/ProductAiWidget";
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

/** The three tiers you can buy yourself, compared side by side. */
const SELF_SERVE_TIERS = TIERS.filter((tier) => tier.id !== "enterprise");
/** Enterprise is a conversation, not a checkout — it gets its own full-width card. */
const ENTERPRISE_TIER = TIERS.find((tier) => tier.id === "enterprise");

const Pricing = () => {
  const rootRef = usePageAnimations();
  const { t } = useI18n();

  return (
    <div ref={rootRef}>
      {/* Plan questions are exactly what the assistant answers best. */}
      <ProductAiWidget />

      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden bg-canvas-subtle">
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

      {/* ================= PLANS =================
          Three self-serve tiers share a grid; Enterprise sits below on its own.
          Four equal columns squeezed every card to about 280px, and Enterprise
          does not belong in that comparison anyway — it has no price to line up
          and its call to action is a conversation, not a signup. Giving it the
          full width lets the three real choices breathe. */}
      <Section tone="subtle" aria-label={t("pricing.eyebrow")}>
        <Container width="wide" className="flex flex-col gap-8">
          <div
            data-reveal-group
            className="mx-auto grid w-full max-w-5xl items-stretch gap-6 md:grid-cols-3"
          >
            {SELF_SERVE_TIERS.map((tier) => (
              <div key={tier.id} data-reveal-item className="h-full">
                <Card
                  className={cn(
                    "flex h-full flex-col gap-7 p-8",
                    tier.featured &&
                      "border-brand-border shadow-lg ring-1 ring-brand-border",
                  )}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex min-h-7 items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-ink">
                        {t(tier.nameKey)}
                      </h2>
                      {tier.featured && (
                        <Badge tone="brand" className="shrink-0">
                          <StarIcon size={13} />
                          {t("pricing.mostPopular")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-ink-muted">
                      {t(tier.descKey)}
                    </p>
                  </div>

                  <p className="flex flex-wrap items-baseline gap-1">
                    <span className="text-4xl font-semibold tracking-tight text-ink">
                      {t(tier.priceKey)}
                    </span>
                    {tier.recurring && (
                      <span className="text-sm text-ink-subtle">
                        {t("pricing.perMonth")}
                      </span>
                    )}
                  </p>

                  <ul className="flex flex-1 flex-col gap-3 border-t border-line pt-7">
                    {tier.featureKeys.map((key) => (
                      <li
                        key={key}
                        className="flex items-start gap-2.5 text-[0.9375rem] leading-relaxed text-ink-muted"
                      >
                        <CheckCircleIcon
                          size={18}
                          className="mt-0.5 shrink-0 text-success-text"
                        />
                        {t(key)}
                      </li>
                    ))}
                  </ul>

                  <ButtonLink to={tier.ctaTo} variant={tier.ctaVariant} fullWidth>
                    {t(tier.ctaKey)}
                    {tier.featured && <ArrowRightIcon size={18} />}
                  </ButtonLink>
                </Card>
              </div>
            ))}
          </div>

          {/* --- Enterprise: full width, laid out side by side --- */}
          {ENTERPRISE_TIER && (
            <div data-reveal className="mx-auto w-full max-w-5xl">
              <Card className="flex flex-col gap-8 p-8 sm:p-10 lg:flex-row lg:items-center lg:gap-12">
                <div className="flex flex-1 flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-xl font-semibold text-ink">
                      {t(ENTERPRISE_TIER.nameKey)}
                    </h2>
                    <p className="max-w-xl text-sm leading-relaxed text-ink-muted">
                      {t(ENTERPRISE_TIER.descKey)}
                    </p>
                  </div>

                  {/* Two columns of features so a long list stays scannable. */}
                  <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                    {ENTERPRISE_TIER.featureKeys.map((key) => (
                      <li
                        key={key}
                        className="flex items-start gap-2.5 text-[0.9375rem] leading-relaxed text-ink-muted"
                      >
                        <CheckCircleIcon
                          size={18}
                          className="mt-0.5 shrink-0 text-success-text"
                        />
                        {t(key)}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex w-full shrink-0 flex-col gap-3 border-t border-line pt-6 lg:w-64 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
                  <p className="text-2xl font-semibold tracking-tight text-ink">
                    {t(ENTERPRISE_TIER.priceKey)}
                  </p>
                  <ButtonLink
                    to={ENTERPRISE_TIER.ctaTo}
                    variant={ENTERPRISE_TIER.ctaVariant}
                    fullWidth
                  >
                    {t(ENTERPRISE_TIER.ctaKey)}
                    <ArrowRightIcon size={18} />
                  </ButtonLink>
                  {ENTERPRISE_TIER.noteKey && (
                    <p className="text-xs leading-relaxed text-ink-subtle">
                      {t(ENTERPRISE_TIER.noteKey)}
                    </p>
                  )}
                </div>
              </Card>
            </div>
          )}

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
