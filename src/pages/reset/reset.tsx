import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ResetNewPassword, ResetVerifyCode, SendResetCode } from "../../apis/reset";
import { usePageAnimations } from "../../lib/animations";
import { PageShell } from "../../components/ui/layout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Alert } from "../../components/ui/feedback";
import { TextField, PasswordField } from "../../components/ui/field";
import { LogoMark } from "../../components/ui/logo";

const STEP_COPY: Record<number, { title: string; description: string }> = {
  1: {
    title: "Send Reset Code",
    description: "Enter your username or email and we'll send you a reset code.",
  },
  2: {
    title: "Verify Code",
    description: "Enter the verification code we sent to your inbox.",
  },
  3: {
    title: "New Password",
    description: "Choose a new password for your account.",
  },
};

const Reset = () => {
    const navigate = useNavigate()
  const rootRef = usePageAnimations();

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
        setServerError("Something went wrong.")
        return;
      }

      // These endpoints answer with a lowercase { success, message } envelope.
      // Reading res.Success here always yielded undefined, so every step
      // advanced even when the server rejected the request.
      if(!res.success){
        setServerError(res.message || "Failed to send reset code")
        return;
      }

      setStep(2);
    } catch (err: any) {
      setServerError("Failed to send reset code");
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
        setServerError("Something went wrong.")
        return;
      }

      if(!res.success){
        setServerError(res.message || "Invalid or expired code")
        return;
      }

      setStep(3);
    } catch (err: any) {
      setServerError("Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  /* STEP 3 — SET NEW PASSWORD */
  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");

    if (newPassword !== repeatPassword) {
      setServerError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      // The code is resent here so the server can bind the password change to
      // the code it actually mailed, rather than trusting a stale "verified"
      // record.
      const res = await ResetNewPassword({user,newPassword,code})

      if(!res){
        setServerError("Something went wrong.")
        return;
      }

      if(!res.success){
        setServerError(res.message || "Failed to reset password")
        return;
      }

      navigate('/login')
    } catch (err: any) {
      setServerError("Failed to reset password");
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
                Step {step} of 3
              </p>
              <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
                {copy.title}
              </h1>
              <p className="text-sm text-ink-muted">{copy.description}</p>
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
                  label="Username or email"
                  type="text"
                  autoComplete="username"
                  placeholder="Username/Email"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  required
                />
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <TextField
                  label="Verification code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Verification Code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <>
                  <PasswordField
                    label="New password"
                    autoComplete="new-password"
                    placeholder="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <PasswordField
                    label="Repeat password"
                    autoComplete="new-password"
                    placeholder="Repeat Password"
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
                loadingLabel="Working…"
              >
                Continue
              </Button>
            </form>

            <p className="mt-6 border-t border-line pt-5 text-center text-sm text-ink-muted">
              Remember Password?{" "}
              <Link
                to="/login"
                className="rounded-sm font-semibold text-brand-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Login
              </Link>
            </p>
          </Card>
        </div>
      </PageShell>
    </div>
  );
};

export default Reset;
