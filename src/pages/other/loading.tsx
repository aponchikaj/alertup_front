import { useEffect, useState, type JSX } from "react";
import { ConnectApis } from "../../apis/connect";
import { MAIN_API_URL } from "../../apis/APIS";
import { LogoMark } from "../../components/ui/logo";
import { Card } from "../../components/ui/card";
import { Alert } from "../../components/ui/feedback";
import { Button } from "../../components/ui/button";
import { CheckIcon, SpinnerIcon } from "../../components/ui/icons";

const ServerGate = ({ children }: { children: JSX.Element }) => {
  const [loading, setLoading] = useState(true);
  const [serverDown, setServerDown] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [retryCount, setRetryCount] = useState(0);

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds

  useEffect(() => {
    const connect = async (attempt: number = 0) => {
      try {
        const res = await ConnectApis();

        if (res?.Success !== true) {
          if (attempt < MAX_RETRIES) {
            // Retry after delay
            setTimeout(() => {
              setRetryCount(attempt + 1);
              connect(attempt + 1);
            }, RETRY_DELAY);
            return;
          }
          setErrorMessage(res?.Message || "Server connection failed");
          setServerDown(true);
          setLoading(false);
          return;
        }

        // Success - server is available
        setLoading(false);
        setServerDown(false);
      } catch (err: any) {
        console.error("ServerGate error:", err);

        if (attempt < MAX_RETRIES) {
          // Retry after delay
          setTimeout(() => {
            setRetryCount(attempt + 1);
            connect(attempt + 1);
          }, RETRY_DELAY);
          return;
        }

        setErrorMessage(err?.message || "Failed to connect to server");
        setServerDown(true);
        setLoading(false);
      }
    };

    connect();
  }, []);

  if (loading) {
    return (
      <section className="flex min-h-screen w-full items-center justify-center bg-canvas px-4">
        <div className="flex flex-col items-center gap-6 text-center">
          <span className="relative grid place-items-center">
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-brand animate-pulse-ring"
            />
            <LogoMark size={64} className="relative" />
          </span>

          <div className="flex flex-col items-center gap-2">
            <p className="font-display text-2xl font-semibold tracking-tight text-ink">
              Alert<span className="text-brand-text">Up</span>
            </p>
            <p
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 text-sm text-ink-muted"
            >
              <SpinnerIcon size={16} className="text-brand-text" />
              Connecting to server…
            </p>
            {retryCount > 0 && (
              <p className="text-sm text-ink-subtle">
                Retry attempt {retryCount}/{MAX_RETRIES}
              </p>
            )}
          </div>

          <p className="text-xs text-ink-subtle">Hosted on free service</p>
        </div>
      </section>
    );
  }

  if (serverDown) {
    return (
      <section className="flex min-h-screen w-full items-center justify-center bg-canvas px-4">
        <Card className="w-full max-w-md p-7 sm:p-8">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <LogoMark size={44} />
              <h1 className="text-xl font-semibold text-ink">
                Server is currently unavailable
              </h1>
            </div>

            {errorMessage && <Alert tone="danger">{errorMessage}</Alert>}

            <div className="flex flex-col gap-2">
              <p className="text-sm text-ink-muted">Please check:</p>
              <ul className="flex flex-col gap-2 text-sm text-ink-subtle">
                {[
                  "Backend server is running",
                  `API URL is correct: ${MAIN_API_URL}`,
                  "CORS is properly configured",
                  "Network connection is active",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-2 text-left">
                    <CheckIcon
                      size={15}
                      className="mt-0.5 shrink-0 text-brand-text"
                    />
                    <span className="break-all">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Button
              fullWidth
              onClick={() => {
                setLoading(true);
                setServerDown(false);
                setRetryCount(0);
                window.location.reload();
              }}
            >
              Retry Connection
            </Button>
          </div>
        </Card>
      </section>
    );
  }

  return children;
};

export default ServerGate;
