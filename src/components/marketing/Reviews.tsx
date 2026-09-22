import { useEffect, useState } from "react";
import { checkUserReviewAvailability, sendFeedbackReview } from "../../apis/reviews";
import { cn } from "../../lib/cn";
import { Button } from "../ui/button";
import { Alert } from "../ui/feedback";
import { Card } from "../ui/card";
import { CheckCircleIcon, StarIcon } from "../ui/icons";
import { TextAreaField } from "../ui/field";
import { useI18n } from "../../i18n/LanguageProvider";

const MAX_COMMENT = 300;

const Reviews = () => {
  const { t } = useI18n();
  // Resolved per render so the labels follow the active language.
  const ratingLabel = (star: number) => t(`reviews.rating${star}`);

  const [step, setStep] = useState(1);
  const [stars, setStars] = useState(0);
  const [hoverStars, setHoverStars] = useState(0);
  const [comment, setComment] = useState("");
  const [serverError, setServerError] = useState("");
  const [sending, setSending] = useState(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const checkIfAlreadySent = async () => {
      try {
        const res = await checkUserReviewAvailability();
        setAvailable(Boolean(res && res.Success !== false));
      } catch {
        setAvailable(false);
      }
    };
    checkIfAlreadySent();
  }, []);

  const sendFeedback = async () => {
    if (stars === 0) {
      setServerError(t("reviews.chooseRating"));
      return;
    }

    setSending(true);
    setServerError("");
    try {
      const res = await sendFeedbackReview({ stars, comment });
      if (!res) {
        setServerError(t("reviews.failed"));
        return;
      }
      if (res.Success === false) {
        // Falls back to a message: a rejection without one set serverError to
        // undefined, so the alert rendered nothing and the form silently
        // returned to idle.
        setServerError(res.Message || t("reviews.failed"));
        return;
      }
      setStep(3);
    } catch {
      setServerError(t("reviews.failed"));
    } finally {
      setSending(false);
    }
  };

  if (!available) return null;

  return (
    <Card className="w-full max-w-xl p-6 sm:p-8">
      <h2 className="text-center text-xl font-semibold text-ink">
        {t("reviews.title")}
      </h2>
      <p className="mt-1 text-center text-sm text-ink-muted">
        {t("reviews.lead")}
      </p>

      {step === 1 && (
        <div className="mt-6 flex flex-col items-center gap-4">
          <div
            role="radiogroup"
            aria-label={t("reviews.ratingLabel")}
            className="flex gap-1"
            onMouseLeave={() => setHoverStars(0)}
          >
            {[1, 2, 3, 4, 5].map((star) => {
              const active = star <= (hoverStars || stars);
              return (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={stars === star}
                  aria-label={t("reviews.ratingValue", {
                    star,
                    label: ratingLabel(star),
                  })}
                  onMouseEnter={() => setHoverStars(star)}
                  onFocus={() => setHoverStars(star)}
                  onBlur={() => setHoverStars(0)}
                  onClick={() => {
                    setStars(star);
                    setServerError("");
                  }}
                  className={cn(
                    "grid h-11 w-11 place-items-center rounded-full",
                    "transition-[color,background-color] duration-150",
                    "hover:bg-brand-subtle",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    active ? "text-brand" : "text-ink-subtle",
                  )}
                >
                  <StarIcon size={26} filled={active} />
                </button>
              );
            })}
          </div>

          {/* The number is stated in text as well, so the rating never depends
              on colour alone. */}
          <p className="min-h-6 text-sm font-medium text-ink-muted" aria-live="polite">
            {stars > 0
              ? t("reviews.ratingValue", { star: stars, label: ratingLabel(stars) })
              : ""}
          </p>

          {serverError && <Alert tone="danger">{serverError}</Alert>}

          <Button
            onClick={() => {
              if (stars > 0) {
                setStep(2);
                setServerError("");
              } else {
                setServerError(t("reviews.chooseRating"));
              }
            }}
          >
            {t("common.next")}
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="mt-6 flex flex-col gap-4">
          <TextAreaField
            label={t("reviews.commentLabel")}
            hint={t("reviews.commentHint")}
            value={comment}
            maxLength={MAX_COMMENT}
            rows={4}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("reviews.commentPlaceholder")}
          />
          <p className="self-end text-xs tabular-nums text-ink-subtle">
            {comment.length}/{MAX_COMMENT}
          </p>

          {serverError && <Alert tone="danger">{serverError}</Alert>}

          <div className="flex justify-center gap-3">
            <Button variant="secondary" onClick={() => setStep(1)}>
              {t("common.back")}
            </Button>
            <Button
              onClick={sendFeedback}
              loading={sending}
              loadingLabel={t("common.sending")}
            >
              {t("reviews.submit")}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-6 flex flex-col items-center gap-2 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-success-subtle text-success-text">
            <CheckCircleIcon size={26} />
          </span>
          <p className="text-lg font-semibold text-ink">
            {t("reviews.thankYouTitle")}
          </p>
          <p className="text-sm text-ink-muted">{t("reviews.thankYouBody")}</p>
        </div>
      )}
    </Card>
  );
};

export default Reviews;
