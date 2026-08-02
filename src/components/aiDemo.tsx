import { useState, type FormEvent } from "react";
import { demoDesign } from "../apis/aiApi";
import { DrawingLayer, type FloorDrawing } from "./map";
import { Container, Section, SectionHeading } from "./ui/layout";
import { Button, ButtonLink } from "./ui/button";
import { Card } from "./ui/card";
import { Alert } from "./ui/feedback";
import { SpinnerIcon, ZapIcon } from "./ui/icons";
import { useI18n } from "../i18n/LanguageProvider";

/* ============================================================================
   AiDemo — the map creator simulator on the home page.
   ----------------------------------------------------------------------------
   Type what you want ("a clinic with 4 rooms"), the real AI floor designer
   designs it, and the plan renders with the SAME DrawingLayer owners and
   visitors see — this is the product, not a mock-up. Anonymous, server
   rate-limited, nothing persists. The CTA underneath turns the wow into a
   sign-up.
   ========================================================================= */

/** Must match the backend's DEMO_CANVAS. */
const CANVAS = { width: 1000, height: 800 };

const CHIP_KEYS = ["homeAi.demoChip1", "homeAi.demoChip2", "homeAi.demoChip3"] as const;

export const AiDemo = () => {
  const { t, lang } = useI18n();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<FloorDrawing | null>(null);

  const generate = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    setReply(null);
    try {
      const result = await demoDesign(trimmed, lang);
      setDrawing(result.drawing);
      setReply(result.reply);
      if (!result.drawing) setError(t("homeAi.demoFailed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("homeAi.demoFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void generate(prompt);
  };

  return (
    <Section tone="subtle" id="ai-demo" aria-labelledby="ai-demo-title">
      <Container width="wide" className="flex flex-col gap-8">
        <div data-reveal>
          <SectionHeading
            eyebrow={t("homeAi.demoEyebrow")}
            title={<span id="ai-demo-title">{t("homeAi.demoTitle")}</span>}
            description={t("homeAi.demoLead")}
          />
        </div>

        <Card data-reveal className="flex flex-col gap-4 p-5 sm:p-7">
          <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={300}
              placeholder={t("homeAi.demoPlaceholder")}
              aria-label={t("homeAi.demoPlaceholder")}
              className="min-h-11 flex-1 rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-ink outline-none placeholder:text-ink-subtle focus-visible:border-line-strong"
            />
            <Button type="submit" disabled={!prompt.trim() || busy}>
              {busy ? (
                <SpinnerIcon size={16} aria-hidden="true" />
              ) : (
                <ZapIcon size={16} aria-hidden="true" />
              )}
              {busy ? t("homeAi.demoGenerating") : t("homeAi.demoGenerate")}
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {CHIP_KEYS.map((key) => {
              const label = t(key);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setPrompt(label);
                    void generate(label);
                  }}
                  className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-surface-hover hover:text-ink disabled:opacity-50"
                >
                  {label}
                </button>
              );
            })}
          </div>

          {error ? <Alert tone="warning">{error}</Alert> : null}

          <div
            className="relative overflow-hidden rounded-xl border border-line bg-surface-2"
            aria-live="polite"
            aria-busy={busy}
          >
            <svg
              viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
              className="block w-full"
              style={{ aspectRatio: `${CANVAS.width} / ${CANVAS.height}` }}
              role="img"
              aria-label={t("homeAi.demoTitle")}
            >
              {/* Editor-style grid so the empty state already looks like the product. */}
              <defs>
                <pattern id="ai-demo-grid" width={50} height={50} patternUnits="userSpaceOnUse">
                  <path
                    d="M 50 0 L 0 0 0 50"
                    fill="none"
                    stroke="var(--line)"
                    strokeWidth={1}
                    opacity={0.6}
                  />
                </pattern>
              </defs>
              <rect width={CANVAS.width} height={CANVAS.height} fill="url(#ai-demo-grid)" />
              {drawing ? <DrawingLayer drawing={drawing} /> : null}
            </svg>

            {!drawing && !busy ? (
              <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-ink-subtle">
                {t("homeAi.demoEmpty")}
              </p>
            ) : null}
            {busy ? (
              <p className="absolute inset-0 grid place-items-center bg-surface/60 text-sm font-medium text-ink">
                <span className="inline-flex items-center gap-2">
                  <SpinnerIcon size={18} aria-hidden="true" />
                  {t("homeAi.demoGenerating")}
                </span>
              </p>
            ) : null}
          </div>

          {reply ? <p className="text-sm text-ink-muted">{reply}</p> : null}

          <div className="flex flex-col items-start justify-between gap-3 border-t border-line pt-4 sm:flex-row sm:items-center">
            <p className="text-sm text-ink-muted">{t("homeAi.demoCtaLead")}</p>
            <ButtonLink to="/register" variant="primary" size="sm">
              {t("homeAi.demoCta")}
            </ButtonLink>
          </div>
        </Card>
      </Container>
    </Section>
  );
};

export default AiDemo;
