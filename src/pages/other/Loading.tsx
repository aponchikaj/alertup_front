import { useEffect, useState, type JSX } from "react";
import { ConnectApis } from "../../apis/connect";
import { Alert } from "../../components/ui/Feedback";
import { Button } from "../../components/ui/Button";
import { useI18n } from "../../i18n/LanguageProvider";

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

/**
 * Background API health check.
 *
 * FX-021: this used to hold EVERY route — the home page, legal pages, the QR
 * scan page — behind a full-screen spinner for up to ~6 s of retries, and
 * then replace the whole site with a developer error screen. With the backend
 * down, visitors saw nothing at all. The page now renders immediately; pages
 * that need the API already handle their own failures, and an unreachable API
 * adds a banner on top instead of taking the site away.
 */
const ServerGate = ({ children }: { children: JSX.Element }) => {
  const { t } = useI18n();
  const [serverDown, setServerDown] = useState(false);
  // Bumped by the Retry button to re-run the check.
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const retryOrFail = (attempt: number) => {
      if (cancelled) return;
      if (attempt < MAX_RETRIES) {
        timer = setTimeout(() => run(attempt + 1), RETRY_DELAY);
        return;
      }
      setServerDown(true);
    };
    function run(attempt: number) {
      ConnectApis()
        .then((res) => {
          if (cancelled) return;
          if (res?.success === true) setServerDown(false);
          else retryOrFail(attempt);
        })
        .catch(() => retryOrFail(attempt));
    }

    run(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [runId]);

  return (
    <>
      {serverDown && (
        <div className="mx-auto w-full max-w-3xl px-4 pt-24 sm:pt-28">
          <Alert tone="danger" title={t("serverGate.title")}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{t("serverGate.body")}</span>
              <Button size="sm" variant="secondary" onClick={() => setRunId((n) => n + 1)}>
                {t("common.retry")}
              </Button>
            </div>
          </Alert>
        </div>
      )}
      {children}
    </>
  );
};

export default ServerGate;
