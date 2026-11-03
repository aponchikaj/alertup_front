import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ResetNewPassword, ResetVerifyCode, SendResetCode } from "../../apis/reset";
import { usePageAnimations } from "../../lib/animations";
import { PageShell } from "../../components/ui/Layout";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Feedback";
import { TextField, PasswordField } from "../../components/ui/Field";
import { LogoMark } from "../../components/ui/Logo";
import { useI18n } from "../../i18n/LanguageProvider";

/** i18n keys for each step's heading and lead line. */
const STEP_COPY: Record<number, { title: string; description: string }> = {
  1: { title: "reset.sendTitle", description: "reset.sendDescription" },
  2: { title: "reset.verifyTitle", description: "reset.verifyDescription" },
  3: { title: "reset.newPasswordTitle", description: "reset.newPasswordDescription" },
};

const Reset = () => {
    const navigate = useNavigate()
  const rootRef = usePageAnimations();
  const { t } = useI18n();

  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string>("");

  const [user, setUser] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [repeatPassword, setRepeatPassword] = useState<string>("");

  /* STEP 1 — SEND CODE */
  const handleSendingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    setLoading(true);

    try {
      const res = await SendResetCode({user});

      if(!res){
        setServerError(t("common.error"))
        return;
      }

      // Checked explicitly: advancing without reading `success` let every
      // step move on even when the server rejected the request.
      if(!res.success){
        setServerError(res.message || t("reset.sendFailed"))
        return;
      }

      setStep(2);
    } catch {
      setServerError(t("reset.sendFailed"));
    } finally {
      setLoading(false);
    }
  };

  /* STEP 2 — VERIFY CODE */
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    setLoading(true);

    try {
      const res=await ResetVerifyCode({user,code})

      if(!res){
        setServerError(t("common.error"))
        return;
      }

      if(!res.success){
        setServerError(res.message || t("reset.invalidCode"))
        return;
      }

      setStep(3);
    } catch {
      setServerError(t("reset.invalidCode"));
    } finally {
      setLoading(false);
    }
  };

  /* STEP 3 — SET NEW PASSWORD */
  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");

    if (newPassword !== repeatPassword) {
      setServerError(t("auth.passwordsMismatch"));
      return;
    }

    setLoading(true);

    try {
      // The code is resent here so the server can bind the password change to
      // the code it actually mailed, rather than trusting a stale "verified"
      // record.
      const res = await ResetNewPassword({user,newPassword,code})

      if(!res){
        setServerError(t("common.error"))
        return;
      }

      if(!res.success){
        setServerError(res.message || t("reset.resetFailed"))
        return;
      }

      navigate('/login')
    } catch {
      setServerError(t("reset.resetFailed"));
    } finally {
      setLoading(false);
    }
  };

  const copy = STEP_COPY[step];

  return (
    <div ref={rootRef}>
      <PageShell className="flex flex-col justify-center">
        <div className="mx-auto w-full max-w-md">
          <Card data-hero className="p-6 sm:p-8">
            <div className="mb-7 flex flex-col items-center gap-3 text-center">
              <LogoMark size={44} />
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-text">
                {t("reset.stepOf", { step, total: 3 })}
              </p>
              <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
                {t(copy.title)}
              </h1>
              <p className="text-sm text-ink-muted">{t(copy.description)}</p>
            </div>

            {/* Step progress */}
            <div
              aria-hidden="true"
              className="mb-6 grid grid-cols-3 gap-1.5"
            >
              {[1, 2, 3].map((s) => (
                <span
                  key={s}
                  className={`h-1.5 rounded-full transition-colors duration-300 ${
                    s <= step ? "bg-brand" : "bg-surface-2"
                  }`}
                />
              ))}
            </div>

            {serverError && (
              <Alert tone="danger" className="mb-5">
                {serverError}
              </Alert>
            )}

            <form
              onSubmit={
                step === 1
                  ? handleSendingCode
                  : step === 2
                  ? handleVerifyCode
                  : handleNewPassword
              }
              className="flex flex-col gap-4"
            >
              {/* STEP 1 */}
              {step === 1 && (
                <TextField
                  label={t("reset.userLabel")}
                  type="text"
                  autoComplete="username"
                  placeholder={t("reset.userPlaceholder")}
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  required
                />
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <TextField
                  label={t("auth.verificationCode")}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder={t("auth.verificationCode")}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <>
                  <PasswordField
                    label={t("reset.newPassword")}
                    autoComplete="new-password"
                    placeholder={t("reset.newPassword")}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <PasswordField
                    label={t("auth.repeatPassword")}
                    autoComplete="new-password"
                    placeholder={t("auth.repeatPassword")}
                    value={repeatPassword}
                    onChange={(e) => setRepeatPassword(e.target.value)}
                    required
                  />
                </>
              )}

              <Button
                type="submit"
                size="lg"
                fullWidth
                loading={loading}
                loadingLabel={t("reset.working")}
              >
                {t("reset.continue")}
              </Button>
            </form>

            <p className="mt-6 border-t border-line pt-5 text-center text-sm text-ink-muted">
              {t("reset.rememberPassword")}{" "}
              <Link
                to="/login"
                className="rounded-sm font-semibold text-brand-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {t("common.login")}
              </Link>
            </p>
          </Card>
        </div>
      </PageShell>
    </div>
  );
};

export default Reset;
