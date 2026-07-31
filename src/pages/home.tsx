import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import Scanner from "../components/scanner";
import Sponsors from "../components/sponsors";
import Reviews from "../components/reviews";
import { ContactAPI } from "../apis/contact";
import { getMe } from "../apis/me";
import Seo from "../seo/Seo";
// FAQ and HOW_TO drive the visible sections further down the page; the JSON-LD
// builders read the same data so the markup can never drift from the copy.
import { FAQ, HOW_TO } from "../seo/seo.config";
import { faqJsonLd, howToJsonLd } from "../seo/structuredData";
import { usePageAnimations } from "../lib/animations";
import { resolveQrTarget } from "../lib/qrTarget";
import { Container, Section, SectionHeading } from "../components/ui/layout";
import { Button, ButtonLink } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Alert, Badge } from "../components/ui/feedback";
import { TextField, TextAreaField } from "../components/ui/field";
import {
  ArrowRightIcon,
  BuildingIcon,
  CheckCircleIcon,
  MapIcon,
  QrCodeIcon,
  RouteIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  ZapIcon,
} from "../components/ui/icons";

const SERVICES = [
  {
    icon: ShieldCheckIcon,
    title: "Emergency Instructions",
    text: "Clear, step-by-step safety guidance tailored to the building and the type of emergency.",
  },
  {
    icon: RouteIcon,
    title: "Escape Route Maps",
    text: "Simple visual evacuation maps that show exits and safe paths inside the building.",
  },
  {
    icon: QrCodeIcon,
    title: "QR Code Access",
    text: "No app needed. Scan a QR code and instantly access emergency safety information.",
  },
] as const;

const TRUST_POINTS = [
  { icon: ZapIcon, label: "Instant — no app install" },
  { icon: BuildingIcon, label: "Per-building & per-floor maps" },
  { icon: SmartphoneIcon, label: "Works on any phone" },
] as const;

const Home = () => {
  const rootRef = usePageAnimations();
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

  const [contactMessage, setContactMessage] = useState("");
  const [contactLoading, setContactLoading] = useState(false);
  const [contactData, setContactData] = useState({
    email: "",
    reason: "",
    message: "",
  });

  const sendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setContactLoading(true);
    try {
      const res = await ContactAPI(contactData);
      if (res?.Success === false) {
        setContactMessage(res.Message);
        return;
      }
      setContactMessage("Sent.");
    } catch {
      // Was "Sent." — reporting success from the failure path.
      setContactMessage("Couldn't send your message. Please try again.");
    } finally {
      setContactLoading(false);
    }
  };

  /* --- QR scanning -------------------------------------------------------- */

  const [qrCodeMessage, setQrCodeMessage] = useState("");

  const getQR = (data: string) => {
    if (!data) return;
    // Allowlisted by hostname — see lib/qrTarget. A substring check accepted
    // any URL merely containing "alertup".
    const target = resolveQrTarget(data);
    if (!target) {
      setQrCodeMessage("Other QR codes can't be used.");
      return;
    }
    try {
      window.location.href = target;
      setQrCodeMessage("");
    } catch {
      setQrCodeMessage("Unable to open QR link.");
    }
  };

  return (
    <div ref={rootRef}>
      {/* The FAQ and HowTo nodes are only valid because both are rendered
          as visible content further down this page. */}
      <Seo jsonLd={[faqJsonLd(), howToJsonLd()]} />

      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden bg-canvas">
        {/* Floor-plan grid backdrop, fading toward the fold. */}
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        {/* Soft brand glow behind the scanner column. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 right-[-10%] h-[28rem] w-[28rem] rounded-full bg-brand/15 blur-3xl"
        />

        <Container
          width="wide"
          className="relative grid items-center gap-12 pb-16 pt-28 sm:pt-32 lg:grid-cols-2 lg:gap-16 lg:pb-24 lg:pt-40"
        >
          {/* Left — message */}
          <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
            <span data-hero>
              <Badge tone="brand" className="px-3 py-1.5 text-[0.8125rem]">
                <ShieldCheckIcon size={15} />
                Scan once &amp; be safe
              </Badge>
            </span>

            {/* The page's only <h1>. The wordmark stays visual; the
                screen-reader text carries what the page is actually about,
                which is also what search engines index. */}
            <h1
              data-hero
              className="text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
            >
              <span className="sr-only">
                AlertUp — QR code evacuation routes and escape maps for buildings
              </span>
              <span aria-hidden="true">
                <span className="text-ink">Every second</span>
                <br />
                <span className="text-gradient-brand">finds the exit.</span>
              </span>
            </h1>

            <p
              data-hero
              className="max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg"
            >
              Scan once and find the{" "}
              <span className="font-semibold text-brand-text">safest way out</span>.
              AlertUp turns official escape maps into instant QR-code evacuation
              routes — for any building, on any phone.
            </p>

            <div data-hero className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              {isLogged ? (
                <ButtonLink to="/dashboard" size="lg">
                  Open dashboard
                  <ArrowRightIcon size={18} />
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink to="/register" size="lg">
                    Get started free
                    <ArrowRightIcon size={18} />
                  </ButtonLink>
                  <ButtonLink to="/login" variant="secondary" size="lg">
                    Log in
                  </ButtonLink>
                </>
              )}
              <a
                href="#how-it-works"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[0.9375rem] font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                How it works
              </a>
            </div>

            <ul
              data-hero
              className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start"
            >
              {TRUST_POINTS.map(({ icon: PointIcon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-1.5 text-sm text-ink-subtle"
                >
                  <PointIcon size={15} className="text-brand-text" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* Right — live scanner */}
          <div data-hero className="flex flex-col items-center gap-4">
            <Card className="w-full max-w-sm p-6 sm:p-8">
              <Scanner brandMark onScan={getQR} />
              <div className="mt-5 flex flex-col items-center gap-1 border-t border-line pt-5 text-center">
                {qrCodeMessage ? (
                  <p role="alert" className="text-sm font-medium text-danger-text">
                    {qrCodeMessage}
                  </p>
                ) : (
                  <p className="text-sm text-ink-subtle">
                    Own a building?
                  </p>
                )}
                <Link
                  to="/new"
                  className="text-sm font-semibold text-brand-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-sm"
                >
                  Create a QR route for it
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
              eyebrow="What you get"
              title={<span id="services-title">Safety that fits on a sticker</span>}
              description="Everything a visitor needs in an emergency, behind one small printed code."
            />
          </div>

          <ul data-reveal-group className="grid gap-5 md:grid-cols-3">
            {SERVICES.map(({ icon: ServiceIcon, title, text }) => (
              <li key={title} data-reveal-item className="h-full">
                <Card interactive className="flex h-full flex-col gap-4 p-7">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-subtle text-brand-text">
                    <ServiceIcon size={24} />
                  </span>
                  <h3 className="text-lg font-semibold text-ink">{title}</h3>
                  <p className="text-sm leading-relaxed text-ink-muted">{text}</p>
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
              eyebrow="Why AlertUp"
              title={<span id="about-title">Official maps, one scan away</span>}
              description="Building owners create a digital profile, upload their official escape and evacuation maps, and generate QR codes for every location. Printed and placed through the building, each code opens the safest route to an exit the moment it's scanned."
            />
            <ul className="flex flex-col gap-3">
              {[
                "Emergency instructions tailored to the building and emergency type",
                "Per-floor escape route maps showing exits and safe paths",
                "QR access with nothing to install",
              ].map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-[0.9375rem] text-ink-muted">
                  <CheckCircleIcon size={19} className="mt-0.5 shrink-0 text-success-text" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div data-reveal="right" className="relative">
            <Card className="p-8">
              <div className="flex items-center gap-4 border-b border-line pb-5">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-subtle text-brand-text">
                  <MapIcon size={24} />
                </span>
                <div>
                  <p className="font-semibold text-ink">Floor 2 — East wing</p>
                  <p className="text-sm text-ink-subtle">Nearest exit: Stairwell B</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 pt-5">
                {HOW_TO.steps.slice(0, 3).map((step, i) => (
                  <div key={step.name} className="flex items-center gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-brand-ink">
                      {i + 1}
                    </span>
                    <p className="text-sm text-ink-muted">{step.name}</p>
                  </div>
                ))}
              </div>
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
              eyebrow="How it works"
              title={<span id="how-it-works-title">{HOW_TO.name}</span>}
              description={HOW_TO.description}
            />
          </div>

          <ol data-reveal-group className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {HOW_TO.steps.map((step, i) => (
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

      {/* ================= SOCIAL PROOF ================= */}
      <Section aria-label="Partners and feedback">
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
      <Section tone="subtle" id="faq" aria-labelledby="faq-title">
        <Container width="prose" className="flex flex-col gap-10">
          <div data-reveal>
            <SectionHeading
              eyebrow="FAQ"
              title={<span id="faq-title">Frequently asked questions</span>}
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
      <Section aria-labelledby="contact-title">
        <Container width="prose">
          <Card data-reveal className="p-7 sm:p-10">
            <div className="mb-7 flex flex-col gap-2 text-center">
              <h2 id="contact-title" className="text-2xl font-semibold text-ink sm:text-3xl">
                Contact us
              </h2>
              <p className="text-sm text-ink-muted sm:text-base">
                Questions about setting up your building? We answer every message.
              </p>
            </div>

            {contactMessage !== "" && (
              <Alert
                tone={contactMessage === "Sent." ? "success" : "danger"}
                className="mb-5"
              >
                {contactMessage === "Sent."
                  ? "Message sent — we'll get back to you soon."
                  : contactMessage}
              </Alert>
            )}

            <form onSubmit={sendMessage} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={contactData.email}
                  onChange={(e) =>
                    setContactData({ ...contactData, email: e.target.value })
                  }
                  required
                />
                <TextField
                  label="Reason"
                  placeholder="e.g. Setting up my building"
                  value={contactData.reason}
                  onChange={(e) =>
                    setContactData({ ...contactData, reason: e.target.value })
                  }
                  required
                />
              </div>
              <TextAreaField
                label="Message"
                placeholder="Tell us what you need…"
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
                loadingLabel="Sending…"
              >
                Send message
              </Button>
            </form>
          </Card>
        </Container>
      </Section>
    </div>
  );
};

export default Home;
