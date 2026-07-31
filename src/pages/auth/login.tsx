import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { LoginUser, Login2faUser } from "../../apis/auth";
import { usePageAnimations } from "../../lib/animations";
import { PageShell } from "../../components/ui/layout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Alert } from "../../components/ui/feedback";
import { TextField, PasswordField } from "../../components/ui/field";
import { LogoMark } from "../../components/ui/logo";

/** Cross-links shown under both the credentials and the 2FA screens. */
const AuthFooterLinks = () => (
  <div className="mt-6 flex flex-col gap-2 border-t border-line pt-5 text-center text-sm text-ink-muted">
    <p>
      Don't have an account?{" "}
      <Link
        to="/register"
        className="rounded-sm font-semibold text-brand-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Register
      </Link>
    </p>
    <p>
      Forgot password?{" "}
      <Link
        to="/reset"
        className="rounded-sm font-semibold text-brand-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Reset
      </Link>
    </p>
  </div>
);

const Login = () => {
  const rootRef = usePageAnimations();
  const navigate = useNavigate();
  // The auth context reads /api/me once on mount. Signing in changes the
  // answer, so it has to be told — without this the session cookie is set but
  // the whole app still renders as a guest until a hard reload.
  const { refresh } = useAuth();

  const [loginData, setLoginData] = useState({
    user: "",
    password: "",
  });
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const [twoFaScreen, setTwoFaScreen] = useState(false);
  const [twoFaCode, setTwoFaCode] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setServerError("");

    try {
      const res = await LoginUser({
        email: loginData.user,
        password: loginData.password,
      });

      if (!res) {
        setServerError("Something went wrong.");
        setLoading(false);
        return;
      }

      if (res.Message == "2fa") {
        setTwoFaScreen(true);
        return;
      }

      if (res.Success === false) {
        setServerError(res.Message?.trim() || "Invalid credentials.");
        setLoading(false);
        return;
      }

      if (res.token) localStorage.setItem("userToken", res.token);

      await refresh();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error(err);
      setServerError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handle2faSubmit = async () => {
    setLoading(true);
    setServerError("");
    try {
      const res = await Login2faUser({
        email: loginData.user,
        verificationCode: twoFaCode,
      });
      if (!res) {
        setServerError("Something went wrong.");
        setLoading(false);
        return;
      }
      if (res.Success == false) {
        setServerError(res.Message);
        setLoading(false);
        return;
      }

      if (res.token) localStorage.setItem("userToken", res.token);

      await refresh();
      navigate("/dashboard", { replace: true });
    } catch {
      console.error("Something went wrong.");
      setServerError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={rootRef}>
      <PageShell className="flex flex-col justify-center">
        <div className="mx-auto w-full max-w-md">
          <Card data-hero className="p-6 sm:p-8">
            <div className="mb-7 flex flex-col items-center gap-3 text-center">
              <LogoMark size={44} />
              <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
                {twoFaScreen ? "Verification code" : "Welcome back"}
              </h1>
              <p className="text-sm text-ink-muted">
                {twoFaScreen
                  ? "Enter the code from your authenticator to finish signing in."
                  : "Log in to manage your buildings and QR routes."}
              </p>
            </div>

            {serverError && (
              <Alert tone="danger" className="mb-5">
                {serverError}
              </Alert>
            )}

            {twoFaScreen == true && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handle2faSubmit();
                }}
                className="flex flex-col gap-4"
              >
                {/* Username/Email for Individual / Company Name */}
                <TextField
                  label="Verification code"
                  type="number"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Code"
                  value={twoFaCode}
                  onChange={(e) => setTwoFaCode(e.target.value)}
                  required
                />

                <Button
                  type="submit"
                  size="lg"
                  fullWidth
                  loading={loading}
                  loadingLabel="Logging in…"
                >
                  Login
                </Button>
              </form>
            )}

            {twoFaScreen == false && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmit();
                }}
                className="flex flex-col gap-4"
              >
                {/* Username/Email for Individual / Company Name */}
                <TextField
                  label="Email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={loginData.user}
                  onChange={(e) =>
                    setLoginData({ ...loginData, user: e.target.value })
                  }
                  required
                />

                <PasswordField
                  label="Password"
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={loginData.password}
                  onChange={(e) =>
                    setLoginData({ ...loginData, password: e.target.value })
                  }
                  required
                />

                <Button
                  type="submit"
                  size="lg"
                  fullWidth
                  loading={loading}
                  loadingLabel="Logging in…"
                >
                  Login
                </Button>
              </form>
            )}

            <AuthFooterLinks />
          </Card>
        </div>
      </PageShell>
    </div>
  );
};

export default Login;
