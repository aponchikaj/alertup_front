import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LoginUser,Login2faUser } from "../../apis/auth";

const Login = () => {
  useEffect(() => {
    document.title = "Log in - AlertUp";
  }, []);

  const navigate = useNavigate();

  const [loginData, setLoginData] = useState({
    user: "",
    password: "",
  });
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const [twoFaScreen,setTwoFaScreen] = useState(false)
  const [twoFaCode,setTwoFaCode] = useState("")

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

      if(res.Message== "2fa"){
        setTwoFaScreen(true)
        return;
      }

      if (res.Success === false) {
        setServerError(res.Message?.trim() || "Invalid credentials.");
        setLoading(false);
        return;
      }

      if (res.token) localStorage.setItem("userToken", res.token);

      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
      setServerError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handle2faSubmit =async()=>{
    setLoading(true);
    setServerError("");
    try{
      const res = await Login2faUser({email:loginData.user,verificationCode:twoFaCode})
      if(!res) {setServerError("Something went wrong.");setLoading(false);return;}
      if(res.Success==false){setServerError(res.Message);setLoading(false);return;}

      if (res.token) localStorage.setItem("userToken", res.token);

      navigate("/", { replace: true });
    }catch{
      console.error("Something went wrong.")
      setServerError("Something went wrong.")
    }finally{setLoading(false)}
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#353535] px-4">
      { 
        twoFaScreen == true &&
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handle2faSubmit()
          }}
          className="w-full max-w-md bg-white/5 backdrop-blur-lg rounded-2xl p-6 md:p-8 shadow-xl border border-white/10"
        >
          <h1 className="text-2xl font-bold text-white text-center mb-6">
            Verification Code
          </h1>

          {serverError && (
            <p className="mt-2 mb-4 text-center text-red-500">{serverError}</p>
          )}

          {/* Username/Email for Individual / Company Name */}
          <input
            type="number"
            placeholder="Code"
            className="w-full mb-3 px-4 py-2 rounded-lg bg-black/40 text-white outline-none border border-white/10 focus:border-[#FF7B22]"
            value={twoFaCode}
            onChange={(e) =>
              setTwoFaCode(e.target.value)
            }
            required
            typeof="number"
          />

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg bg-[#FF7B22] disabled:opacity-50 disabled:cursor-not-allowed transition text-white font-semibold"
          >
            {loading ? "Loading..." : "Login"}
          </button>

          <p className="text-sm text-gray-400 text-center mt-4">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-[#FF7B22] cursor-pointer hover:underline"
            >
              Register
            </Link>
          </p>
          <p className="text-sm text-gray-400 text-center mt-2">
            Forgot password?{" "}
            <Link
              to="/reset"
              className="text-[#FF7B22] cursor-pointer hover:underline"
            >
              Reset
            </Link>
          </p>
        </form>
      }
      { twoFaScreen == false &&
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="w-full max-w-md bg-white/5 backdrop-blur-lg rounded-2xl p-6 md:p-8 shadow-xl border border-white/10"
        >
          <h1 className="text-2xl font-bold text-white text-center mb-6">
            Welcome Back
          </h1>

          {serverError && (
            <p className="mt-2 mb-4 text-center text-red-500">{serverError}</p>
          )}

          {/* Username/Email for Individual / Company Name */}
          <input
            type="email"
            placeholder="Email"
            className="w-full mb-3 px-4 py-2 rounded-lg bg-black/40 text-white outline-none border border-white/10 focus:border-[#FF7B22]"
            value={loginData.user}
            onChange={(e) =>
              setLoginData({ ...loginData, user: e.target.value })
            }
            required
          />

          {/* Password */}
          <input
            type="password"
            placeholder="Password"
            className="w-full mb-4 px-4 py-2 rounded-lg bg-black/40 text-white outline-none border border-white/10 focus:border-[#FF7B22]"
            value={loginData.password}
            onChange={(e) =>
              setLoginData({ ...loginData, password: e.target.value })
            }
            required
          />

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg bg-[#FF7B22] disabled:opacity-50 disabled:cursor-not-allowed transition text-white font-semibold"
          >
            {loading ? "Loading..." : "Login"}
          </button>

          <p className="text-sm text-gray-400 text-center mt-4">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-[#FF7B22] cursor-pointer hover:underline"
            >
              Register
            </Link>
          </p>
          <p className="text-sm text-gray-400 text-center mt-2">
            Forgot password?{" "}
            <Link
              to="/reset"
              className="text-[#FF7B22] cursor-pointer hover:underline"
            >
              Reset
            </Link>
          </p>
        </form>
      }
    </div>
  );
};

export default Login;
