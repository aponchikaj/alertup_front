import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ResetNewPassword, ResetVerifyCode, SendResetCode } from "../../apis/reset";

const Reset = () => {
  useEffect(() => {
        document.title = "Reset - AlertUp";
    }, []);
    const navigate = useNavigate()

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

      if(res.Success==false){
        setServerError(res.Message)
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

      if(res.Success==false){
        setServerError(res.Message)
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
      const res = await ResetNewPassword({user,newPassword,})

      if(!res){
        setServerError("Something went wrong.")
        return;
      }

      if(res.Success==false){
        setServerError(res.Message)
        return;
      }

      navigate('/login')
    } catch (err: any) {
      setServerError("Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-full h-screen p-[10px] flex items-center justify-center bg-[#353535]">
      <form
        onSubmit={
          step === 1
            ? handleSendingCode
            : step === 2
            ? handleVerifyCode
            : handleNewPassword
        }
        className="w-full max-w-md bg-white/5 backdrop-blur-lg rounded-2xl p-6 md:p-8 shadow-xl border border-white/10"
      >
        <h1 className="text-2xl font-bold text-white text-center mb-6">
          {step === 1 && "Send Reset Code"}
          {step === 2 && "Verify Code"}
          {step === 3 && "New Password"}
        </h1>

        {serverError && (
          <p className="mb-4 text-center text-red-500">{serverError}</p>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <input
            type="text"
            placeholder="Username/Email"
            className="w-full mb-3 px-4 py-2 rounded-lg bg-black/40 text-white outline-none border border-white/10 focus:border-[#FF7B22]"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            required
          />
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <input
            type="text"
            placeholder="Verification Code"
            className="w-full mb-3 px-4 py-2 rounded-lg bg-black/40 text-white outline-none border border-white/10 focus:border-[#FF7B22]"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <>
            <input
              type="password"
              placeholder="New Password"
              className="w-full mb-3 px-4 py-2 rounded-lg bg-black/40 text-white outline-none border border-white/10 focus:border-[#FF7B22]"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Repeat Password"
              className="w-full mb-3 px-4 py-2 rounded-lg bg-black/40 text-white outline-none border border-white/10 focus:border-[#FF7B22]"
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              required
            />
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-lg bg-[#FF7B22] hover:scale-105 transition text-white font-semibold disabled:opacity-50"
        >
          {loading ? "Loading..." : "Continue"}
        </button>

        <p className="text-sm text-gray-400 text-center mt-4">
          Remember Password?{" "}
          <Link
            to="/login"
            className="text-[#FF7B22] hover:underline"
          >
            Login
          </Link>
        </p>
      </form>
    </main>
  );
};

export default Reset;
