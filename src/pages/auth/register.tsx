import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RegisterUser } from "../../apis/auth";

const Register = () => {
  useEffect(() => {
    document.title = "Register - AlertUp";
  }, []);

  const navigate = useNavigate();

  const countries = [ 
    { name: "Afghanistan", code: "AF", phoneCode: "+93" }, { name: "Albania", code: "AL", phoneCode: "+355" }, { name: "Algeria", code: "DZ", phoneCode: "+213" }, { name: "Andorra", code: "AD", phoneCode: "+376" }, { name: "Angola", code: "AO", phoneCode: "+244" }, { name: "Antigua and Barbuda", code: "AG", phoneCode: "+1-268" }, { name: "Argentina", code: "AR", phoneCode: "+54" }, { name: "Armenia", code: "AM", phoneCode: "+374" }, { name: "Australia", code: "AU", phoneCode: "+61" }, { name: "Austria", code: "AT", phoneCode: "+43" }, { name: "Azerbaijan", code: "AZ", phoneCode: "+994" }, { name: "Bahamas", code: "BS", phoneCode: "+1-242" }, { name: "Bahrain", code: "BH", phoneCode: "+973" }, { name: "Bangladesh", code: "BD", phoneCode: "+880" }, { name: "Barbados", code: "BB", phoneCode: "+1-246" }, { name: "Belarus", code: "BY", phoneCode: "+375" }, { name: "Belgium", code: "BE", phoneCode: "+32" }, { name: "Belize", code: "BZ", phoneCode: "+501" }, { name: "Benin", code: "BJ", phoneCode: "+229" }, { name: "Bhutan", code: "BT", phoneCode: "+975" }, { name: "Bolivia", code: "BO", phoneCode: "+591" }, { name: "Bosnia and Herzegovina", code: "BA", phoneCode: "+387" }, { name: "Botswana", code: "BW", phoneCode: "+267" }, { name: "Brazil", code: "BR", phoneCode: "+55" }, { name: "Brunei", code: "BN", phoneCode: "+673" }, { name: "Bulgaria", code: "BG", phoneCode: "+359" }, { name: "Burkina Faso", code: "BF", phoneCode: "+226" }, { name: "Burundi", code: "BI", phoneCode: "+257" }, { name: "Cambodia", code: "KH", phoneCode: "+855" }, { name: "Cameroon", code: "CM", phoneCode: "+237" }, { name: "Canada", code: "CA", phoneCode: "+1" }, { name: "Cape Verde", code: "CV", phoneCode: "+238" }, { name: "Central African Republic", code: "CF", phoneCode: "+236" }, { name: "Chad", code: "TD", phoneCode: "+235" }, { name: "Chile", code: "CL", phoneCode: "+56" }, { name: "China", code: "CN", phoneCode: "+86" }, { name: "Colombia", code: "CO", phoneCode: "+57" }, { name: "Comoros", code: "KM", phoneCode: "+269" }, { name: "Congo", code: "CG", phoneCode: "+242" }, { name: "Costa Rica", code: "CR", phoneCode: "+506" }, { name: "Croatia", code: "HR", phoneCode: "+385" }, { name: "Cuba", code: "CU", phoneCode: "+53" }, { name: "Cyprus", code: "CY", phoneCode: "+357" }, { name: "Czech Republic", code: "CZ", phoneCode: "+420" }, { name: "Denmark", code: "DK", phoneCode: "+45" }, { name: "Djibouti", code: "DJ", phoneCode: "+253" }, { name: "Dominica", code: "DM", phoneCode: "+1-767" }, { name: "Dominican Republic", code: "DO", phoneCode: "+1-809" }, { name: "Ecuador", code: "EC", phoneCode: "+593" }, { name: "Egypt", code: "EG", phoneCode: "+20" }, { name: "El Salvador", code: "SV", phoneCode: "+503" }, { name: "Equatorial Guinea", code: "GQ", phoneCode: "+240" }, { name: "Eritrea", code: "ER", phoneCode: "+291" }, { name: "Estonia", code: "EE", phoneCode: "+372" }, { name: "Eswatini", code: "SZ", phoneCode: "+268" }, { name: "Ethiopia", code: "ET", phoneCode: "+251" }, { name: "Fiji", code: "FJ", phoneCode: "+679" }, { name: "Finland", code: "FI", phoneCode: "+358" }, { name: "France", code: "FR", phoneCode: "+33" }, { name: "Gabon", code: "GA", phoneCode: "+241" }, { name: "Gambia", code: "GM", phoneCode: "+220" }, { name: "Georgia", code: "GE", phoneCode: "+995" }, { name: "Germany", code: "DE", phoneCode: "+49" }, { name: "Ghana", code: "GH", phoneCode: "+233" }, { name: "Greece", code: "GR", phoneCode: "+30" }, { name: "Grenada", code: "GD", phoneCode: "+1-473" }, { name: "Guatemala", code: "GT", phoneCode: "+502" }, { name: "Guinea", code: "GN", phoneCode: "+224" }, { name: "Guyana", code: "GY", phoneCode: "+592" }, { name: "Haiti", code: "HT", phoneCode: "+509" }, { name: "Honduras", code: "HN", phoneCode: "+504" }, { name: "Hungary", code: "HU", phoneCode: "+36" }, { name: "Iceland", code: "IS", phoneCode: "+354" }, { name: "India", code: "IN", phoneCode: "+91" }, { name: "Indonesia", code: "ID", phoneCode: "+62" }, { name: "Iran", code: "IR", phoneCode: "+98" }, { name: "Iraq", code: "IQ", phoneCode: "+964" }, { name: "Ireland", code: "IE", phoneCode: "+353" }, { name: "Israel", code: "IL", phoneCode: "+972" }, { name: "Italy", code: "IT", phoneCode: "+39" }, { name: "Jamaica", code: "JM", phoneCode: "+1-876" }, { name: "Japan", code: "JP", phoneCode: "+81" }, { name: "Jordan", code: "JO", phoneCode: "+962" }, { name: "Kazakhstan", code: "KZ", phoneCode: "+7" }, { name: "Kenya", code: "KE", phoneCode: "+254" }, { name: "Kuwait", code: "KW", phoneCode: "+965" }, { name: "Latvia", code: "LV", phoneCode: "+371" }, { name: "Lebanon", code: "LB", phoneCode: "+961" }, { name: "Liberia", code: "LR", phoneCode: "+231" }, { name: "Lithuania", code: "LT", phoneCode: "+370" }, { name: "Luxembourg", code: "LU", phoneCode: "+352" }, { name: "Malaysia", code: "MY", phoneCode: "+60" }, { name: "Mexico", code: "MX", phoneCode: "+52" }, { name: "Moldova", code: "MD", phoneCode: "+373" }, { name: "Monaco", code: "MC", phoneCode: "+377" }, { name: "Mongolia", code: "MN", phoneCode: "+976" }, { name: "Montenegro", code: "ME", phoneCode: "+382" }, { name: "Morocco", code: "MA", phoneCode: "+212" }, { name: "Nepal", code: "NP", phoneCode: "+977" }, { name: "Netherlands", code: "NL", phoneCode: "+31" }, { name: "New Zealand", code: "NZ", phoneCode: "+64" }, { name: "Nigeria", code: "NG", phoneCode: "+234" }, { name: "Norway", code: "NO", phoneCode: "+47" }, { name: "Pakistan", code: "PK", phoneCode: "+92" }, { name: "Panama", code: "PA", phoneCode: "+507" }, { name: "Peru", code: "PE", phoneCode: "+51" }, { name: "Philippines", code: "PH", phoneCode: "+63" }, { name: "Poland", code: "PL", phoneCode: "+48" }, { name: "Portugal", code: "PT", phoneCode: "+351" }, { name: "Qatar", code: "QA", phoneCode: "+974" }, { name: "Romania", code: "RO", phoneCode: "+40" }, { name: "Russia", code: "RU", phoneCode: "+7" }, { name: "Saudi Arabia", code: "SA", phoneCode: "+966" }, { name: "Serbia", code: "RS", phoneCode: "+381" }, { name: "Singapore", code: "SG", phoneCode: "+65" }, { name: "Slovakia", code: "SK", phoneCode: "+421" }, { name: "Slovenia", code: "SI", phoneCode: "+386" }, { name: "South Africa", code: "ZA", phoneCode: "+27" }, { name: "South Korea", code: "KR", phoneCode: "+82" }, { name: "Spain", code: "ES", phoneCode: "+34" }, { name: "Sri Lanka", code: "LK", phoneCode: "+94" }, { name: "Sweden", code: "SE", phoneCode: "+46" }, { name: "Switzerland", code: "CH", phoneCode: "+41" }, { name: "Thailand", code: "TH", phoneCode: "+66" }, { name: "Tunisia", code: "TN", phoneCode: "+216" }, { name: "Turkey", code: "TR", phoneCode: "+90" }, { name: "Ukraine", code: "UA", phoneCode: "+380" }, { name: "United Arab Emirates", code: "AE", phoneCode: "+971" }, { name: "United Kingdom", code: "GB", phoneCode: "+44" }, { name: "United States", code: "US", phoneCode: "+1" }, { name: "Uzbekistan", code: "UZ", phoneCode: "+998" }, { name: "Venezuela", code: "VE", phoneCode: "+58" }, { name: "Vietnam", code: "VN", phoneCode: "+84" }, { name: "Yemen", code: "YE", phoneCode: "+967" }, { name: "Zambia", code: "ZM", phoneCode: "+260" }, { name: "Zimbabwe", code: "ZW", phoneCode: "+263" } 
    ];

  const [userType, setUserType] = useState<"Individual" | "Company">("Individual");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [newUserData, setNewUserData] = useState({
    name: "",
    lastname: "",
    company: "",
    password: "",
    email: "",
    phone: "",
    country: "",
    countryCode: "",
    userType
  });
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCountryChange = (countryName: string) => {
    const selected = countries.find(c => c.name === countryName);
    setNewUserData({
      ...newUserData,
      country: countryName,
      countryCode: selected?.phoneCode || ""
    });
  };

  const passwordStrength = (password: string) => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  };

  const handleSubmit = async () => {
    setServerError("");
    setLoading(true);

    if (newUserData.password !== repeatPassword) {
      setServerError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const res = await RegisterUser(newUserData);
      console.log(res)
      if (!res) {
        setServerError("Something went wrong.");
        setLoading(false);
        return;
      }
      if (res.Success === false) {
        setServerError(res.Message);
        setLoading(false);
        return;
      }

      navigate("/");
    } catch {
      setServerError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#353535] px-4">
      <div className="w-full h-[10vh]" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="w-full max-w-md bg-white/5 backdrop-blur-lg rounded-2xl p-6 md:p-8 shadow-xl border border-white/10"
      >
        <h1 className="text-2xl font-bold text-white text-center mb-6">Create Account</h1>

        {serverError && <p className="mt-2 text-center text-red-500">{serverError}</p>}

        {/* User Type */}
        <section className="w-full flex gap-2 justify-center mb-4">
          <button
              type="button"
              key={"Individual"}
              onClick={() => setUserType("Individual")}
              className={`px-4 py-2 rounded-lg border transition ${
                userType === "Individual"
                  ? "bg-[#FF7B22] border-[#FF7B22] text-white font-semibold"
                  : "bg-black/40 border-white/10 text-white hover:border-[#FF7B22]"
              }`}
            >
              Individual
            </button>

            <button
              type="button"
              key={"Company"}
              onClick={() => setUserType("Company")}
              className={`px-4 py-2 rounded-lg border transition ${
                userType === "Company"
                  ? "bg-[#FF7B22] border-[#FF7B22] text-white font-semibold"
                  : "bg-black/40 border-white/10 text-white hover:border-[#FF7B22]"
              }`}
            >
              Company
            </button>
        </section>

        {/* Name / Company */}
        {userType === "Individual" ? (
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="Name"
              className="w-full px-4 py-2 rounded-lg bg-black/40 text-white border border-white/10 outline-none focus:border-[#FF7B22]"
              value={newUserData.name}
              onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Lastname"
              className="w-full px-4 py-2 rounded-lg bg-black/40 text-white border border-white/10 outline-none focus:border-[#FF7B22]"
              value={newUserData.lastname}
              onChange={(e) => setNewUserData({ ...newUserData, lastname: e.target.value })}
              required
            />
          </div>
        ) : (
          <input
            type="text"
            placeholder="Company"
            className="w-full mb-3 px-4 py-2 rounded-lg bg-black/40 text-white border border-white/10 outline-none focus:border-[#FF7B22]"
            value={newUserData.company}
            onChange={(e) => setNewUserData({ ...newUserData, company: e.target.value })}
            required
          />
        )}

        {/* Email */}
        <input
          type="email"
          placeholder="Email"
          className="w-full mb-3 px-4 py-2 rounded-lg bg-black/40 text-white border border-white/10 outline-none focus:border-[#FF7B22]"
          value={newUserData.email}
          onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
          required
        />

        {/* Country */}
        <select
          className="w-full mb-3 px-4 py-2 rounded-lg bg-black/40 text-white border border-white/10 outline-none focus:border-[#FF7B22]"
          value={newUserData.country}
          onChange={(e) => handleCountryChange(e.target.value)}
          required
        >
          <option value="">Select country</option>
          {countries.map((c) => (
            <option key={c.code} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Phone */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="+Code"
            className="w-1/3 px-4 py-2 rounded-lg bg-black/40 text-white border border-white/10"
            value={newUserData.countryCode}
            readOnly
          />
          <input
            type="tel"
            placeholder="Phone number"
            className="w-2/3 px-4 py-2 rounded-lg bg-black/40 text-white border border-white/10 outline-none focus:border-[#FF7B22]"
            value={newUserData.phone}
            onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
            required
          />
        </div>

        {/* Password */}
        <div className="relative mb-3">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            className="w-full px-4 py-2 rounded-lg bg-black/40 text-white border border-white/10 outline-none focus:border-[#FF7B22]"
            value={newUserData.password}
            onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        {/* Password Strength */}
        {newUserData.password && (
          <div className="mb-3">
            <div className="h-2 w-full bg-white/20 rounded">
              <div
                className={`h-2 rounded transition-all ${
                  passwordStrength(newUserData.password) <= 1
                    ? "bg-red-500 w-1/4"
                    : passwordStrength(newUserData.password) === 2
                    ? "bg-yellow-400 w-1/2"
                    : passwordStrength(newUserData.password) === 3
                    ? "bg-green-400 w-3/4"
                    : "bg-green-600 w-full"
                }`}
              ></div>
            </div>
            <p className="text-xs text-gray-300 mt-1">
              Password must be at least 8 characters, include uppercase, number, and symbol.
            </p>
          </div>
        )}

        {/* Repeat Password */}
        <div className="relative mb-4">
          <input
            type={showRepeatPassword ? "text" : "password"}
            placeholder="Repeat password"
            className="w-full px-4 py-2 rounded-lg bg-black/40 text-white border border-white/10 outline-none focus:border-[#FF7B22]"
            value={repeatPassword}
            onChange={(e) => setRepeatPassword(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShowRepeatPassword(!showRepeatPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white"
          >
            {showRepeatPassword ? "Hide" : "Show"}
          </button>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-lg bg-[#FF7B22] disabled:opacity-50 disabled:cursor-not-allowed transition text-white font-semibold flex justify-center items-center gap-2"
        >
          {loading && (
            <svg
              className="animate-spin h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              ></path>
            </svg>
          )}
          {loading ? "Loading..." : "Register"}
        </button>

        <p className="text-sm text-gray-400 text-center mt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-[#FF7B22] cursor-pointer hover:underline">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
};

export default Register;
