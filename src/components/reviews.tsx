import { useEffect, useState } from "react";
import { checkUserReviewAvailability, sendFeedbackReview } from "../apis/reviews";
import { cn } from "../lib/cn";
import { Button } from "./ui/button";
import { Alert } from "./ui/feedback";
import { Card } from "./ui/card";
import { CheckCircleIcon, StarIcon } from "./ui/icons";
import { TextAreaField } from "./ui/field";

const RATING_LABELS = ["Terrible", "Bad", "Okay", "Good", "Excellent"];
const MAX_COMMENT = 300;

const Reviews = () => {
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
      setServerError("Please choose a rating first.");
      return;
    }

    setSending(true);
    setServerError("");
    try {
      const res = await sendFeedbackReview({ stars, comment });
      if (!res) {
        setServerError("Something went wrong. Please try again.");
        return;
      }
      if (res.Success === false) {
        // Falls back to a message: a rejection without one set serverError to
        // undefined, so the alert rendered nothing and the form silently
        // returned to idle.
        setServerError(res.Message || "Something went wrong. Please try again.");
        return;
      }
      setStep(3);
    } catch {
      setServerError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (!available) return null;

  return (
    <Card className="w-full max-w-xl p-6 sm:p-8">
      <h2 className="text-center text-xl font-semibold text-ink">
        How are we doing?
      </h2>
      <p className="mt-1 text-center text-sm text-ink-muted">
        Thirty seconds of feedback makes the next version better.
      </p>

      {step === 1 && (
        <div className="mt-6 flex flex-col items-center gap-4">
          <div
            role="radiogroup"
            aria-label="Rating out of five"
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
                  aria-label={`${star} of 5 — ${RATING_LABELS[star - 1]}`}
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
            {stars > 0 ? `${stars} of 5 — ${RATING_LABELS[stars - 1]}` : ""}
          </p>

          {serverError && <Alert tone="danger">{serverError}</Alert>}

          <Button
            onClick={() => {
              if (stars > 0) {
                setStep(2);
                setServerError("");
              } else {
                setServerError("Please choose a rating first.");
              }
            }}
          >
            Continue
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="mt-6 flex flex-col gap-4">
          <TextAreaField
            label="Anything you'd like to add?"
            hint="Optional — but the specifics are the useful part."
            value={comment}
            maxLength={MAX_COMMENT}
            rows={4}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What worked, what didn't…"
          />
          <p className="self-end text-xs tabular-nums text-ink-subtle">
            {comment.length}/{MAX_COMMENT}
          </p>

          {serverError && <Alert tone="danger">{serverError}</Alert>}

          <div className="flex justify-center gap-3">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={sendFeedback} loading={sending} loadingLabel="Sending…">
              Send feedback
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-6 flex flex-col items-center gap-2 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-success-subtle text-success-text">
            <CheckCircleIcon size={26} />
          </span>
          <p className="text-lg font-semibold text-ink">Thank you</p>
          <p className="text-sm text-ink-muted">
            Your feedback goes straight to the person building this.
          </p>
        </div>
      )}
    </Card>
  );
};

export default Reviews;
