import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/LanguageProvider";
import { usePageAnimations } from "../../lib/animations";
import { Container, Section } from "../../components/ui/layout";
import { ButtonLink } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Badge } from "../../components/ui/feedback";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  StarIcon,
} from "../../components/ui/icons";

const FREE_FEATURE_KEYS = [
  "pricing.featFreeBuildings",
  "pricing.featFreeCodes",
  "pricing.featFreeInstructions",
] as const;

const PRO_FEATURE_KEYS = [
  "pricing.featProEverything",
  "pricing.featProBuildings",
  "pricing.featProAnalytics",
  "pricing.featProLogs",
  "pricing.featProSupport",
] as const;

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
        <Container className="flex flex-col gap-10">
          <div
            data-reveal-group
            className="mx-auto grid w-full max-w-4xl items-stretch gap-6 md:grid-cols-2"
          >
            {/* --- Free plan --- */}
            <div data-reveal-item className="h-full">
              <Card className="flex h-full flex-col gap-6 p-7 sm:p-8">
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-lg font-semibold text-ink">
                    {t("pricing.freeName")}
                  </h2>
                  <p className="text-sm text-ink-muted">
                    {t("pricing.freeDesc")}
                  </p>
                </div>

                <p className="flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight text-ink">
                    {t("pricing.freePrice")}
                  </span>
                  <span className="text-sm text-ink-subtle">
                    {t("pricing.perMonth")}
                  </span>
                </p>

                <ul className="flex flex-1 flex-col gap-3 border-t border-line pt-6">
                  {FREE_FEATURE_KEYS.map((key) => (
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

                <ButtonLink to="/register" variant="secondary" fullWidth>
                  {t("pricing.startFree")}
                </ButtonLink>
              </Card>
            </div>

            {/* --- Premium plan (elevated) --- */}
            <div data-reveal-item className="h-full">
              <Card className="relative flex h-full flex-col gap-6 border-brand-border p-7 shadow-lg ring-1 ring-brand-border sm:p-8">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1.5">
                    <h2 className="text-lg font-semibold text-ink">
                      {t("pricing.proName")}
                    </h2>
                    <p className="text-sm text-ink-muted">
                      {t("pricing.proDesc")}
                    </p>
                  </div>
                  <Badge tone="brand" className="shrink-0">
                    <StarIcon size={13} />
                    {t("pricing.proName")}
                  </Badge>
                </div>

                <p className="flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight text-ink">
                    {/* No dictionary key for the Premium price — see faqNote. */}
                    29₾
                  </span>
                  <span className="text-sm text-ink-subtle">
                    {t("pricing.perMonth")}
                  </span>
                </p>

                <ul className="flex flex-1 flex-col gap-3 border-t border-line pt-6">
                  {PRO_FEATURE_KEYS.map((key) => (
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

                <ButtonLink to="/register" fullWidth>
                  {t("pricing.goPremium")}
                  <ArrowRightIcon size={18} />
                </ButtonLink>
              </Card>
            </div>
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
