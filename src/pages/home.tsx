import { useEffect, useState, type ComponentType, type FormEvent } from "react";
import { Link } from "react-router-dom";
import Scanner from "../components/scanner";
import ProductAiWidget from "../components/ai/ProductAiWidget";
import Sponsors from "../components/sponsors";
import Reviews from "../components/reviews";
import { ContactAPI } from "../apis/contact";
import { getMe } from "../apis/me";
import Seo from "../seo/Seo";
import LightRays from "../components/ui/lightRays";
// FAQ and HOW_TO drive the visible sections further down the page; the JSON-LD
// builders read the same data so the markup can never drift from the copy.
import { FAQ, HOW_TO } from "../seo/seo.config";
import { faqJsonLd, howToJsonLd } from "../seo/structuredData";
import { useI18n } from "../i18n/LanguageProvider";
import { useTheme } from "../theme/useTheme";
import { usePageAnimations } from "../lib/animations";
import { resolveQrTarget } from "../lib/qrTarget";
import { cn } from "../lib/cn";
import { Container, Section, SectionHeading } from "../components/ui/layout";
import { Button, ButtonLink } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Alert, Badge } from "../components/ui/feedback";
import { TextField, TextAreaField } from "../components/ui/field";
import type { IconProps } from "../components/ui/icon";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ExitDoorIcon,
  LayersIcon,
  MapPinIcon,
  RouteIcon,
  ScanIcon,
  SearchIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  ZapIcon,
} from "../components/ui/icons";

type IconComponent = ComponentType<IconProps>;

/* The three pillars of the platform, in positioning order: everyday
   wayfinding first, emergency second, the AI concierge third. */
const SERVICES: ReadonlyArray<{
  icon: IconComponent;
  titleKey: string;
  textKey: string;
}> = [
  {
    icon: RouteIcon,
    titleKey: "home.serviceWayfindingTitle",
    textKey: "home.serviceWayfindingText",
  },
  {
    icon: ShieldCheckIcon,
    titleKey: "home.serviceEmergencyTitle",
    textKey: "home.serviceEmergencyText",
  },
  {
    icon: SearchIcon,
    titleKey: "home.serviceAiTitle",
    textKey: "home.serviceAiText",
  },
];

const TRUST_POINTS: ReadonlyArray<{ icon: IconComponent; labelKey: string }> = [
  { icon: ZapIcon, labelKey: "home.trustInstant" },
  { icon: LayersIcon, labelKey: "home.trustFloors" },
  { icon: SmartphoneIcon, labelKey: "home.trustPhones" },
];

const ABOUT_POINT_KEYS = [
  "home.aboutPoint1",
  "home.aboutPoint2",
  "home.aboutPoint3",
] as const;

/** Nothing here is live data — it is a still of what a visitor sees after a
 *  scan: where they are, the floor change, and where they are heading. */
const MOCKUP_STEPS: ReadonlyArray<{
  icon: IconComponent;
  labelKey: string;
  valueKey: string;
  emphasis?: boolean;
}> = [
  {
    icon: MapPinIcon,
    labelKey: "wayfinding.yourLocation",
    valueKey: "home.mockupFloor",
  },
  {
    icon: LayersIcon,
    labelKey: "wayfinding.changeFloor",
    valueKey: "home.mockupStep",
  },
  {
    icon: ExitDoorIcon,
    labelKey: "wayfinding.destination",
    valueKey: "home.mockupDestination",
    emphasis: true,
  },
];

/** Non-empty values map to a dictionary key, so the banner text translates. */
type QrError = "" | "home.qrRejected" | "home.qrOpenFailed";
type ContactStatus = "idle" | "sent" | "error";

const Home = () => {
  const rootRef = usePageAnimations();
  const { t } = useI18n();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [isLogged, setIsLogged] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const checkIfLogged = async () => {
      try {
        const res = await getMe();
        if (!cancelled) setIsLogged(Boolean(res?.Success));
      } catch {
        if (!cancelled) setIsLogged(false);
      }
    };
    checkIfLogged();
    return () => {
      cancelled = true;
    };
  }, []);

  /* --- Contact ----------------------------------------------------------- */

  const [contactStatus, setContactStatus] = useState<ContactStatus>("idle");
  const [contactError, setContactError] = useState("");
  const [contactLoading, setContactLoading] = useState(false);
  const [contactData, setContactData] = useState({
    email: "",
    reason: "",
    message: "",
  });

  const sendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setContactLoading(true);
    setContactStatus("idle");
    setContactError("");
    try {
      const res = await ContactAPI(contactData);
      if (res?.Success === false) {
        setContactError(res.Message || t("contact.failed"));
        setContactStatus("error");
        return;
      }
      setContactStatus("sent");
    } catch {
      // Was reporting success from the failure path.
      setContactError(t("contact.failed"));
      setContactStatus("error");
    } finally {
      setContactLoading(false);
    }
  };

  /* --- QR scanning -------------------------------------------------------- */

  const [qrError, setQrError] = useState<QrError>("");

  const getQR = (data: string) => {
    if (!data) return;
    // Allowlisted by hostname — see lib/qrTarget. A substring check accepted
    // any URL merely containing "alertup".
    const target = resolveQrTarget(data);
    if (!target) {
      setQrError("home.qrRejected");
      return;
    }
    try {
      window.location.href = target;
      setQrError("");
    } catch {
      setQrError("home.qrOpenFailed");
    }
  };

  return (
    <div ref={rootRef}>
      {/* The FAQ and HowTo nodes are only valid because both are rendered
          as visible content further down this page. */}
      <Seo jsonLd={[faqJsonLd(), howToJsonLd()]} />

      {/* Visitors can talk to the product before signing up. */}
      <ProductAiWidget />

      {/* ================= HERO =================
          Follows the theme. Light rays are emitted light — they only read as
          rays against a dark surface, and forcing the hero dark in light mode
          just looked broken. So dark mode gets the rays; light mode gets the
          floor-plan grid it always had. */}
      <section className="relative overflow-hidden bg-canvas">
        {isDark ? (
          <LightRays
            raysOrigin="top-center"
            raysColor="#ffffff"
            raysSpeed={0.9}
            lightSpread={0.6}
            rayLength={2.4}
            followMouse
            mouseInfluence={0.08}
            saturation={0}
            fadeDistance={1.1}
          />
        ) : null}
        <div
          className={cn(
            "bg-grid pointer-events-none absolute inset-0",
            isDark && "opacity-25",
          )}
          aria-hidden="true"
        />
        {/* Soft glow behind the scanner column, light mode only — under the
            rays it would just muddy them. */}
        {!isDark && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 right-[-10%] h-[28rem] w-[28rem] rounded-full bg-brand/10 blur-3xl"
          />
        )}

        <Container
          width="wide"
          className="relative grid items-center gap-12 pb-16 pt-28 sm:pt-32 lg:grid-cols-2 lg:gap-16 lg:pb-24 lg:pt-40"
        >
          {/* Left — message */}
          <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
            <span data-hero>
              <Badge tone="brand" className="px-3 py-1.5 text-[0.8125rem]">
                <ScanIcon size={15} />
                {t("home.badge")}
              </Badge>
            </span>

            {/* The page's only <h1>. The two-line treatment stays visual; the
                screen-reader text carries what the page is actually about,
                which is also what search engines index. */}
            <h1
              data-hero
              className="text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
            >
              <span className="sr-only">{t("home.srTitle")}</span>
              <span aria-hidden="true">
                <span className="text-ink">{t("home.heroTitleTop")}</span>
                <br />
                <span className="text-gradient-brand">
                  {t("home.heroTitleBottom")}
                </span>
              </span>
            </h1>

            <p
              data-hero
              className="max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg"
            >
              {t("home.heroLead1")}
              <span className="font-semibold text-brand-text">
                {t("home.heroLeadHighlight")}
              </span>
              {t("home.heroLead2")}
            </p>

            <div data-hero className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              {isLogged ? (
                <ButtonLink to="/dashboard" size="lg">
                  {t("common.openDashboard")}
                  <ArrowRightIcon size={18} />
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink to="/register" size="lg">
                    {t("common.getStartedFree")}
                    <ArrowRightIcon size={18} />
                  </ButtonLink>
                  <ButtonLink to="/login" variant="secondary" size="lg">
                    {t("common.login")}
                  </ButtonLink>
                </>
              )}
              <a
                href="#how-it-works"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[0.9375rem] font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {t("home.howItWorks")}
              </a>
            </div>

            <ul
              data-hero
              className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start"
            >
              {TRUST_POINTS.map(({ icon: PointIcon, labelKey }) => (
                <li
                  key={labelKey}
                  className="flex items-center gap-1.5 text-sm text-ink-subtle"
                >
                  <PointIcon size={15} className="text-brand-text" />
                  {t(labelKey)}
                </li>
              ))}
            </ul>
          </div>

          {/* Right — live scanner */}
          <div data-hero className="flex flex-col items-center gap-4">
            <Card className="w-full max-w-sm p-6 sm:p-8">
              <Scanner brandMark onScan={getQR} />
              <div className="mt-5 flex flex-col items-center gap-1 border-t border-line pt-5 text-center">
                {qrError ? (
                  <p role="alert" className="text-sm font-medium text-danger-text">
                    {t(qrError)}
                  </p>
                ) : (
                  <p className="text-sm text-ink-subtle">
                    {t("home.ownBuilding")}
                  </p>
                )}
                <Link
                  to="/new"
                  className="rounded-sm text-sm font-semibold text-brand-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {t("home.createRoute")}
                </Link>
              </div>
            </Card>
          </div>
        </Container>
      </section>

      {/* ================= SERVICES ================= */}
      <Section tone="subtle" aria-labelledby="services-title">
        <Container width="wide" className="flex flex-col gap-12">
          <div data-reveal>
            <SectionHeading
              eyebrow={t("home.servicesEyebrow")}
              title={<span id="services-title">{t("home.servicesTitle")}</span>}
              description={t("home.servicesLead")}
            />
          </div>

          <ul data-reveal-group className="grid gap-5 md:grid-cols-3">
            {SERVICES.map(({ icon: ServiceIcon, titleKey, textKey }) => (
              <li key={titleKey} data-reveal-item className="h-full">
                <Card interactive className="flex h-full flex-col gap-4 p-7">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-subtle text-brand-text">
                    <ServiceIcon size={24} />
                  </span>
                  <h3 className="text-lg font-semibold text-ink">{t(titleKey)}</h3>
                  <p className="text-sm leading-relaxed text-ink-muted">
                    {t(textKey)}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* ================= WHAT IS ALERTUP ================= */}
      <Section aria-labelledby="about-title">
        <Container className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div data-reveal="left" className="flex flex-col gap-5">
            <SectionHeading
              align="left"
              eyebrow={t("home.aboutEyebrow")}
              title={<span id="about-title">{t("home.aboutTitle")}</span>}
              description={t("home.aboutLead")}
            />
            <ul className="flex flex-col gap-3">
              {ABOUT_POINT_KEYS.map((key) => (
                <li
                  key={key}
                  className="flex items-start gap-2.5 text-[0.9375rem] text-ink-muted"
                >
                  <CheckCircleIcon size={19} className="mt-0.5 shrink-0 text-success-text" />
                  {t(key)}
                </li>
              ))}
            </ul>
          </div>

          {/* A still of the product: the route a visitor gets after scanning
              at the main entrance and searching for a shop upstairs. */}
          <div data-reveal="right" className="relative">
            <Card className="p-6 sm:p-8">
              {/* Search bar — presentational, so it is a <p>, not an <input>. */}
              <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3">
                <SearchIcon size={18} className="shrink-0 text-ink-subtle" />
                <p className="truncate text-[0.9375rem] font-medium text-ink">
                  {t("home.mockupDestination")}
                </p>
              </div>

              <ol className="mt-6 flex flex-col border-t border-line pt-6">
                {MOCKUP_STEPS.map(
                  ({ icon: StepIcon, labelKey, valueKey, emphasis }, i) => (
                    <li
                      key={valueKey}
                      className="relative flex gap-4 pb-6 last:pb-0"
                    >
                      {i < MOCKUP_STEPS.length - 1 && (
                        <span
                          aria-hidden="true"
                          // left-5 = the 40px marker's centre; the line runs
                          // from just under it to the next marker.
                          className="absolute bottom-0 left-5 top-11 w-px -translate-x-1/2 bg-line-strong"
                        />
                      )}
                      <span
                        className={cn(
                          "relative grid h-10 w-10 shrink-0 place-items-center rounded-full border",
                          emphasis
                            ? "border-brand bg-brand text-brand-ink"
                            : "border-line bg-surface-2 text-ink-muted",
                        )}
                      >
                        <StepIcon size={19} />
                      </span>
                      <div className="flex min-w-0 flex-col gap-1 pt-1">
                        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                          {t(labelKey)}
                        </span>
                        <span
                          className={cn(
                            "text-[0.9375rem] font-medium",
                            emphasis ? "text-brand-text" : "text-ink",
                          )}
                        >
                          {t(valueKey)}
                        </span>
                      </div>
                    </li>
                  ),
                )}
              </ol>
            </Card>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-8 -right-6 -z-10 h-40 w-40 rounded-full bg-brand/10 blur-2xl"
            />
          </div>
        </Container>
      </Section>

      {/* ================= HOW IT WORKS ================= */}
      {/* The visible counterpart of the HowTo schema. */}
      <Section tone="subtle" id="how-it-works" aria-labelledby="how-it-works-title">
        <Container width="wide" className="flex flex-col gap-12">
          <div data-reveal>
            <SectionHeading
              eyebrow={t("home.howItWorks")}
              title={<span id="how-it-works-title">{HOW_TO.name}</span>}
              description={HOW_TO.description}
            />
          </div>

          <ol data-reveal-group className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {HOW_TO.steps.map((step, i) => (
              // The HowTo JSON-LD points each step at #step-N — keep the ids.
              <li
                key={step.name}
                id={`step-${i + 1}`}
                data-reveal-item
                className="h-full"
              >
                <Card className="flex h-full flex-col gap-3 p-6">
                  <span
                    aria-hidden="true"
                    className="grid h-9 w-9 place-items-center rounded-full bg-brand font-bold text-brand-ink"
                  >
                    {i + 1}
                  </span>
                  <h3 className="font-semibold text-ink">{step.name}</h3>
                  <p className="text-sm leading-relaxed text-ink-muted">{step.text}</p>
                </Card>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* ================= PRICING TEASER ================= */}
      {/* Deliberately thin — /pricing does the selling. */}
      <Section aria-labelledby="pricing-teaser-title">
        <Container>
          <Card
            data-reveal
            className="flex flex-col items-center gap-5 p-7 text-center sm:flex-row sm:items-center sm:justify-between sm:p-9 sm:text-left"
          >
            <div className="flex flex-col gap-1.5">
              <h2
                id="pricing-teaser-title"
                className="text-xl font-semibold text-ink sm:text-2xl"
              >
                {t("pricing.title")}
              </h2>
              <p className="max-w-xl text-sm text-ink-muted sm:text-base">
                {t("pricing.lead")}
              </p>
            </div>
            <ButtonLink to="/pricing" variant="secondary" className="shrink-0">
              {t("common.pricing")}
              <ArrowRightIcon size={18} />
            </ButtonLink>
          </Card>
        </Container>
      </Section>

      {/* ================= SOCIAL PROOF ================= */}
      {/* Deliberately unnamed: <Sponsors /> and <Reviews /> each bring their
          own heading, so labelling the wrapper would only duplicate them. */}
      <Section tone="subtle">
        <Container className="flex flex-col items-center gap-12">
          <div data-reveal>
            <Sponsors align="center" />
          </div>
          <div data-reveal className="flex w-full justify-center">
            <Reviews />
          </div>
        </Container>
      </Section>

      {/* ================= FAQ ================= */}
      {/* The visible counterpart of the FAQPage schema. Google only honours
          FAQ rich results when the answers are on the page. */}
      <Section id="faq" aria-labelledby="faq-title">
        <Container width="prose" className="flex flex-col gap-10">
          <div data-reveal>
            <SectionHeading
              eyebrow={t("home.faqEyebrow")}
              title={<span id="faq-title">{t("home.faqTitle")}</span>}
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

      {/* ================= CONTACT ================= */}
      <Section tone="subtle" aria-labelledby="contact-title">
        <Container width="prose">
          <Card data-reveal className="p-7 sm:p-10">
            <div className="mb-7 flex flex-col gap-2 text-center">
              <h2 id="contact-title" className="text-2xl font-semibold text-ink sm:text-3xl">
                {t("home.contactTitle")}
              </h2>
              <p className="text-sm text-ink-muted sm:text-base">
                {t("home.contactLead")}
              </p>
            </div>

            {contactStatus !== "idle" && (
              <Alert
                tone={contactStatus === "sent" ? "success" : "danger"}
                className="mb-5"
              >
                {contactStatus === "sent" ? t("home.contactSent") : contactError}
              </Alert>
            )}

            <form onSubmit={sendMessage} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label={t("home.emailLabel")}
                  type="email"
                  autoComplete="email"
                  placeholder={t("common.emailPlaceholder")}
                  value={contactData.email}
                  onChange={(e) =>
                    setContactData({ ...contactData, email: e.target.value })
                  }
                  required
                />
                <TextField
                  label={t("home.reasonLabel")}
                  placeholder={t("home.reasonPlaceholder")}
                  value={contactData.reason}
                  onChange={(e) =>
                    setContactData({ ...contactData, reason: e.target.value })
                  }
                  required
                />
              </div>
              <TextAreaField
                label={t("home.messageLabel")}
                placeholder={t("home.messagePlaceholder")}
                rows={6}
                value={contactData.message}
                onChange={(e) =>
                  setContactData({ ...contactData, message: e.target.value })
                }
                required
              />
              <Button
                type="submit"
                size="lg"
                fullWidth
                loading={contactLoading}
                loadingLabel={t("common.sending")}
              >
                {t("common.send")}
              </Button>
            </form>
          </Card>
        </Container>
      </Section>
    </div>
  );
};

export default Home;
