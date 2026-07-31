import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "../../i18n/LanguageProvider";
import { useAuth } from "../../auth/useAuth";
import { ApiError, errorMessage } from "../../apis/http";
import { acceptInvite, getInviteByToken, type InvitePreview } from "../../apis/rbacApi";
import { usePageAnimations } from "../../lib/animations";
import { PageShell } from "../../components/ui/layout";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Alert, EmptyState, Skeleton } from "../../components/ui/feedback";
import { Button, ButtonLink } from "../../components/ui/button";
import { useToast } from "../../components/ui/toast";
import { AlertTriangleIcon, MailIcon, RefreshIcon } from "../../components/ui/icons";

/* ============================================================================
   Public invitation landing page: /invite/accept?token=…

   The token is the whole credential, which is why this route is registered
   `noindex, nofollow` and why the page never renders it back to the user.

   A guest who lands here is sent to /login or /register with the token stashed
   in sessionStorage. Neither auth page knows anything about invitations — the
   pickup happens here, on mount, once a session exists.
   ========================================================================= */

const STASH_KEY = "alertup-invite-token";

const readStash = (): string => {
  try {
    return sessionStorage.getItem(STASH_KEY) ?? "";
  } catch {
    return "";
  }
};

const writeStash = (token: string) => {
  try {
    sessionStorage.setItem(STASH_KEY, token);
  } catch {
    /* private mode / storage disabled — the emailed link still works */
  }
};

const clearStash = () => {
  try {
    sessionStorage.removeItem(STASH_KEY);
  } catch {
    /* nothing to clean up */
  }
};

type Phase = "loading" | "ready" | "invalid" | "error";

const InviteAccept = () => {
  const rootRef = usePageAnimations();
  const { t } = useI18n();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { status: authStatus, user, refresh } = useAuth();
  const [searchParams] = useSearchParams();

  // Read once, at mount: its presence is what marks this visit as a return
  // trip from the login/register detour, which is what may auto-accept.
  const [stashedToken] = useState(readStash);
  const urlToken = searchParams.get("token") ?? "";
  const token = urlToken || stashedToken;

  const [phase, setPhase] = useState<Phase>("loading");
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [acceptError, setAcceptError] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  /* --- Validate the token ------------------------------------------------ */

  useEffect(() => {
    if (!token) {
      setPhase("invalid");
      return;
    }

    let cancelled = false;
    setPhase("loading");

    getInviteByToken(token)
      .then((res) => {
        if (cancelled) return;
        setPreview(res.data ?? null);
        setPhase("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // 404 is the backend's single answer for invalid, expired and already
        // used. Anything else is a transport problem worth retrying.
        if (err instanceof ApiError && err.status === 404) {
          setPhase("invalid");
          return;
        }
        setLoadError(errorMessage(err));
        setPhase("error");
      });

    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  /* --- Guests: stash the token so the auth detour does not lose it ------- */

  useEffect(() => {
    if (authStatus === "guest" && token) writeStash(token);
  }, [authStatus, token]);

  /* --- Acceptance -------------------------------------------------------- */

  const accept = useCallback(async () => {
    if (!token) return;
    setAcceptError("");
    setAccepting(true);
    try {
      const res = await acceptInvite(token);
      clearStash();
      const buildingName = res.data?.buildingName || preview?.buildingName || "";
      toast({ title: t("invite.accepted", { building: buildingName }), tone: "success" });
      // Memberships changed, so the shared auth context is now stale.
      await refresh();
      navigate(`/building/${res.data?.buildingId ?? ""}`, { replace: true });
    } catch (err) {
      setAcceptError(errorMessage(err));
    } finally {
      setAccepting(false);
    }
  }, [token, preview, toast, t, refresh, navigate]);

  const inviteEmail = (preview?.email ?? "").trim().toLowerCase();
  const myEmail = String(user?.email ?? "").trim().toLowerCase();
  // An unknown account email is not evidence of a mismatch — let the server
  // be the one to refuse, rather than blocking a legitimate acceptance.
  const wrongAccount = Boolean(myEmail) && Boolean(inviteEmail) && myEmail !== inviteEmail;

  const autoAcceptedRef = useRef(false);
  useEffect(() => {
    if (autoAcceptedRef.current) return;
    if (!stashedToken) return;
    if (phase !== "ready" || authStatus !== "authed" || wrongAccount) return;
    autoAcceptedRef.current = true;
    clearStash();
    accept();
  }, [stashedToken, phase, authStatus, wrongAccount, accept]);

  /* --- Render ------------------------------------------------------------ */

  const nextParam = encodeURIComponent(`/invite/accept?token=${token}`);

  if (phase === "loading" || (phase === "ready" && authStatus === "loading")) {
    return (
      <PageShell width="prose">
        <div role="status" aria-live="polite" className="flex flex-col gap-4">
          <span className="sr-only">{t("common.loading")}</span>
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-40" />
        </div>
      </PageShell>
    );
  }

  if (phase === "invalid") {
    return (
      <PageShell width="prose">
        <EmptyState
          icon={<AlertTriangleIcon size={24} />}
          title={t("invite.invalidTitle")}
          description={t("invite.invalidBody")}
          action={
            <ButtonLink to="/" variant="secondary">
              {t("invite.backHome")}
            </ButtonLink>
          }
        />
      </PageShell>
    );
  }

  if (phase === "error") {
    return (
      <PageShell width="prose">
        <EmptyState
          icon={<AlertTriangleIcon size={24} />}
          title={t("common.error")}
          description={loadError}
          action={
            <Button type="button" onClick={() => setReloadKey((n) => n + 1)}>
              <RefreshIcon size={16} />
              {t("common.retry")}
            </Button>
          }
        />
      </PageShell>
    );
  }

  return (
    <div ref={rootRef}>
      <PageShell width="prose">
        <div data-hero>
          <Card>
            <CardHeader>
              <CardTitle>{t("invite.title")}</CardTitle>
              <CardDescription>
                {t("invite.bodyShort", {
                  building: preview?.buildingName ?? "",
                  role: preview?.roleName ?? "",
                })}
              </CardDescription>
            </CardHeader>

            <CardBody className="flex flex-col gap-4">
              <p className="text-sm text-ink-subtle">
                {t("invite.emailNotice", { email: preview?.email ?? "" })}
              </p>

              {acceptError && <Alert tone="danger">{acceptError}</Alert>}

              {authStatus === "authed" && wrongAccount && (
                <Alert tone="warning">
                  {t("invite.wrongAccount", { email: preview?.email ?? "" })}
                </Alert>
              )}

              {authStatus === "authed" && !wrongAccount && (
                <div>
                  <Button
                    type="button"
                    onClick={accept}
                    loading={accepting}
                    loadingLabel={t("invite.accepting")}
                  >
                    <MailIcon size={16} />
                    {t("invite.accept")}
                  </Button>
                </div>
              )}

              {authStatus !== "authed" && (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <ButtonLink to={`/login?next=${nextParam}`}>
                    {t("invite.signInToAccept")}
                  </ButtonLink>
                  <ButtonLink to={`/register?next=${nextParam}`} variant="secondary">
                    {t("invite.createAccountToAccept")}
                  </ButtonLink>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </PageShell>
    </div>
  );
};

export default InviteAccept;
