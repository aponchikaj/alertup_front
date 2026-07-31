import { useI18n } from "../../i18n/LanguageProvider";
import { usePageAnimations } from "../../lib/animations";
// Same visible data as home.tsx; home owns the FAQ/HowTo JSON-LD, so this
// page renders the content only — no structured data here.
import { FAQ, HOW_TO } from "../../seo/seo.config";
import { Container, Section, SectionHeading } from "../../components/ui/layout";
import { ButtonLink } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { MailIcon } from "../../components/ui/icons";

const Help = () => {
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
            {t("help.eyebrow")}
          </span>
          {/* The page's only <h1>. */}
          <h1
            data-hero
            className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl"
          >
            {t("help.title")}
          </h1>
          <p
            data-hero
            className="max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg"
          >
            {t("help.lead")}
          </p>
        </Container>
      </section>

      {/* ================= FOR VISITORS ================= */}
      <Section tone="subtle" aria-labelledby="visitors-title">
        <Container width="wide" className="flex flex-col gap-12">
          <div data-reveal>
            <SectionHeading
              title={<span id="visitors-title">{t("help.forVisitors")}</span>}
              description={HOW_TO.description}
            />
          </div>

          <ol data-reveal-group className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {HOW_TO.steps.map((step, i) => (
              <li key={step.name} data-reveal-item className="h-full">
                <Card className="flex h-full flex-col gap-3 p-6">
                  <span
                    aria-hidden="true"
                    className="grid h-9 w-9 place-items-center rounded-full bg-brand font-bold text-brand-ink"
                  >
                    {i + 1}
                  </span>
                  <h3 className="font-semibold text-ink">{step.name}</h3>
                  <p className="text-sm leading-relaxed text-ink-muted">
                    {step.text}
                  </p>
                </Card>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* ================= FOR BUILDING OWNERS ================= */}
      <Section aria-labelledby="owners-title">
        <Container width="prose" className="flex flex-col gap-10">
          <div data-reveal>
            <SectionHeading
              title={<span id="owners-title">{t("help.forOwners")}</span>}
            />
          </div>

          <div data-reveal-group className="flex flex-col gap-3">
            {FAQ.map((item) => (
              <details
                key={item.question}
                data-reveal-item
                className="group rounded-2xl border border-line bg-surface p-5 transition-colors open:border-brand-border"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  <h3 className="inline text-[0.9375rem] font-semibold sm:text-base">
                    {item.question}
                  </h3>
                  <span
                    aria-hidden="true"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-subtle text-lg text-brand-text transition-transform duration-200 ease-out group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="pt-3 text-sm leading-relaxed text-ink-muted">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </Container>
      </Section>

      {/* ================= STILL STUCK ================= */}
      <Section tone="subtle" aria-labelledby="still-stuck-title">
        <Container width="prose">
          <Card data-reveal className="flex flex-col items-center gap-4 p-7 text-center sm:p-10">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-subtle text-brand-text">
              <MailIcon size={24} />
            </span>
            <h2
              id="still-stuck-title"
              className="text-2xl font-semibold text-ink sm:text-3xl"
            >
              {t("help.stillStuck")}
            </h2>
            <p className="max-w-md text-sm text-ink-muted sm:text-base">
              {t("help.stillStuckLead")}
            </p>
            <ButtonLink to="/contact" size="lg" className="mt-2">
              {t("help.contactSupport")}
            </ButtonLink>
          </Card>
        </Container>
      </Section>
    </div>
  );
};

export default Help;
