import { useState } from "react";
import { Link } from "react-router-dom";
import Scanner from "../../components/qr/Scanner";
import Seo from "../../seo/Seo";
import { breadcrumbJsonLd } from "../../seo/structuredData";
import { usePageAnimations } from "../../lib/animations";
import { resolveQrTarget } from "../../lib/qrTarget";
import { Container } from "../../components/ui/layout";
import { Card } from "../../components/ui/card";
import { Badge } from "../../components/ui/feedback";
import { ButtonLink } from "../../components/ui/button";
import { ArrowLeftIcon, QrCodeIcon } from "../../components/ui/icons";
import { useI18n } from "../../i18n/LanguageProvider";

const Scan = () => {
  const rootRef = usePageAnimations();
  const { t } = useI18n();
  const [qrCodeMessage, setQrCodeMessage] = useState("");


  const GetQR = (data: string) => {
    if (!data) return;

    // Validated against an allowlist of AlertUp hostnames. A substring check
    // for "alertup" would happily accept https://evil.example.com/#alertup.
    const target = resolveQrTarget(data);
    if (!target) {
      setQrCodeMessage(t("home.qrRejected"));
      return;
    }

    try {
      window.location.href = target;
      setQrCodeMessage(""); // Clear any previous message
    } catch (err) {
      console.error("Failed to open QR link:", err);
      setQrCodeMessage(t("home.qrOpenFailed"));
    }
  };

  return (
    <div ref={rootRef}>
      <Seo
        jsonLd={[
          breadcrumbJsonLd([
            { name: t("common.home"), path: "/" },
            { name: t("scan.breadcrumbScan"), path: "/scan" },
          ]),
        ]}
      />

      <section className="relative min-h-screen overflow-hidden bg-canvas pb-16 pt-28 sm:pt-32">
        {/* Soft brand glow behind the scanner. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-brand/15 blur-3xl"
        />

        <Container className="relative flex flex-col items-center gap-8">
          <div data-hero className="self-start">
            <ButtonLink to="/" variant="ghost" size="sm">
              <ArrowLeftIcon size={16} />
              {t("scan.backHome")}
            </ButtonLink>
          </div>

          <div data-hero className="flex flex-col items-center gap-4 text-center">
            <Badge tone="brand" className="px-3 py-1.5 text-[0.8125rem]">
              <QrCodeIcon size={15} />
              {t("scan.eyebrow")}
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              {t("scan.title")}
            </h1>
            <p className="max-w-md text-base leading-relaxed text-ink-muted">
              {t("scan.lead")}
            </p>
          </div>

          <div data-hero className="w-full max-w-md">
            <Card className="flex flex-col items-center p-6 sm:p-8">
              {/* Scanner Component */}
              <div className="flex flex-col items-center justify-center md:hidden">
                <Scanner
                  w={250}
                  h={250}
                  brandMark
                  onScan={(d) => GetQR(d)}
                />
              </div>

              <div className="hidden flex-col items-center justify-center md:flex">
                <Scanner
                  w={300}
                  h={300}
                  brandMark
                  onScan={(d) => GetQR(d)}
                />
              </div>

              {/* Message Display */}
              <div className="mt-5 flex w-full flex-col items-center gap-1 border-t border-line pt-5 text-center">
                {qrCodeMessage === "" ? (
                  <p className="text-sm text-ink-subtle">
                    {t("scan.ownBuilding")}{" "}
                    <Link
                      to="/new"
                      className="rounded-sm font-semibold text-brand-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {t("scan.createRoute")}
                    </Link>
                  </p>
                ) : (
                  <p role="alert" className="text-sm font-medium text-danger-text">
                    {qrCodeMessage}
                  </p>
                )}
              </div>
            </Card>
          </div>
        </Container>
      </section>
    </div>
  );
};

export default Scan;
