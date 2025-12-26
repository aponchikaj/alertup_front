import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RegisterUser } from "../../apis/auth";

const Register = () => {

  useEffect(() => {
        document.title = "Register - AlertUp";
    }, []);

    const navigate = useNavigate()

  const countries = [ 
    { name: "Afghanistan", code: "AF", phoneCode: "+93" }, { name: "Albania", code: "AL", phoneCode: "+355" }, { name: "Algeria", code: "DZ", phoneCode: "+213" }, { name: "Andorra", code: "AD", phoneCode: "+376" }, { name: "Angola", code: "AO", phoneCode: "+244" }, { name: "Antigua and Barbuda", code: "AG", phoneCode: "+1-268" }, { name: "Argentina", code: "AR", phoneCode: "+54" }, { name: "Armenia", code: "AM", phoneCode: "+374" }, { name: "Australia", code: "AU", phoneCode: "+61" }, { name: "Austria", code: "AT", phoneCode: "+43" }, { name: "Azerbaijan", code: "AZ", phoneCode: "+994" }, { name: "Bahamas", code: "BS", phoneCode: "+1-242" }, { name: "Bahrain", code: "BH", phoneCode: "+973" }, { name: "Bangladesh", code: "BD", phoneCode: "+880" }, { name: "Barbados", code: "BB", phoneCode: "+1-246" }, { name: "Belarus", code: "BY", phoneCode: "+375" }, { name: "Belgium", code: "BE", phoneCode: "+32" }, { name: "Belize", code: "BZ", phoneCode: "+501" }, { name: "Benin", code: "BJ", phoneCode: "+229" }, { name: "Bhutan", code: "BT", phoneCode: "+975" }, { name: "Bolivia", code: "BO", phoneCode: "+591" }, { name: "Bosnia and Herzegovina", code: "BA", phoneCode: "+387" }, { name: "Botswana", code: "BW", phoneCode: "+267" }, { name: "Brazil", code: "BR", phoneCode: "+55" }, { name: "Brunei", code: "BN", phoneCode: "+673" }, { name: "Bulgaria", code: "BG", phoneCode: "+359" }, { name: "Burkina Faso", code: "BF", phoneCode: "+226" }, { name: "Burundi", code: "BI", phoneCode: "+257" }, { name: "Cambodia", code: "KH", phoneCode: "+855" }, { name: "Cameroon", code: "CM", phoneCode: "+237" }, { name: "Canada", code: "CA", phoneCode: "+1" }, { name: "Cape Verde", code: "CV", phoneCode: "+238" }, { name: "Central African Republic", code: "CF", phoneCode: "+236" }, { name: "Chad", code: "TD", phoneCode: "+235" }, { name: "Chile", code: "CL", phoneCode: "+56" }, { name: "China", code: "CN", phoneCode: "+86" }, { name: "Colombia", code: "CO", phoneCode: "+57" }, { name: "Comoros", code: "KM", phoneCode: "+269" }, { name: "Congo", code: "CG", phoneCode: "+242" }, { name: "Costa Rica", code: "CR", phoneCode: "+506" }, { name: "Croatia", code: "HR", phoneCode: "+385" }, { name: "Cuba", code: "CU", phoneCode: "+53" }, { name: "Cyprus", code: "CY", phoneCode: "+357" }, { name: "Czech Republic", code: "CZ", phoneCode: "+420" }, { name: "Denmark", code: "DK", phoneCode: "+45" }, { name: "Djibouti", code: "DJ", phoneCode: "+253" }, { name: "Dominica", code: "DM", phoneCode: "+1-767" }, { name: "Dominican Republic", code: "DO", phoneCode: "+1-809" }, { name: "Ecuador", code: "EC", phoneCode: "+593" }, { name: "Egypt", code: "EG", phoneCode: "+20" }, { name: "El Salvador", code: "SV", phoneCode: "+503" }, { name: "Equatorial Guinea", code: "GQ", phoneCode: "+240" }, { name: "Eritrea", code: "ER", phoneCode: "+291" }, { name: "Estonia", code: "EE", phoneCode: "+372" }, { name: "Eswatini", code: "SZ", phoneCode: "+268" }, { name: "Ethiopia", code: "ET", phoneCode: "+251" }, { name: "Fiji", code: "FJ", phoneCode: "+679" }, { name: "Finland", code: "FI", phoneCode: "+358" }, { name: "France", code: "FR", phoneCode: "+33" }, { name: "Gabon", code: "GA", phoneCode: "+241" }, { name: "Gambia", code: "GM", phoneCode: "+220" }, { name: "Georgia", code: "GE", phoneCode: "+995" }, { name: "Germany", code: "DE", phoneCode: "+49" }, { name: "Ghana", code: "GH", phoneCode: "+233" }, { name: "Greece", code: "GR", phoneCode: "+30" }, { name: "Grenada", code: "GD", phoneCode: "+1-473" }, { name: "Guatemala", code: "GT", phoneCode: "+502" }, { name: "Guinea", code: "GN", phoneCode: "+224" }, { name: "Guyana", code: "GY", phoneCode: "+592" }, { name: "Haiti", code: "HT", phoneCode: "+509" }, { name: "Honduras", code: "HN", phoneCode: "+504" }, { name: "Hungary", code: "HU", phoneCode: "+36" }, { name: "Iceland", code: "IS", phoneCode: "+354" }, { name: "India", code: "IN", phoneCode: "+91" }, { name: "Indonesia", code: "ID", phoneCode: "+62" }, { name: "Iran", code: "IR", phoneCode: "+98" }, { name: "Iraq", code: "IQ", phoneCode: "+964" }, { name: "Ireland", code: "IE", phoneCode: "+353" }, { name: "Israel", code: "IL", phoneCode: "+972" }, { name: "Italy", code: "IT", phoneCode: "+39" }, { name: "Jamaica", code: "JM", phoneCode: "+1-876" }, { name: "Japan", code: "JP", phoneCode: "+81" }, { name: "Jordan", code: "JO", phoneCode: "+962" }, { name: "Kazakhstan", code: "KZ", phoneCode: "+7" }, { name: "Kenya", code: "KE", phoneCode: "+254" }, { name: "Kuwait", code: "KW", phoneCode: "+965" }, { name: "Latvia", code: "LV", phoneCode: "+371" }, { name: "Lebanon", code: "LB", phoneCode: "+961" }, { name: "Liberia", code: "LR", phoneCode: "+231" }, { name: "Lithuania", code: "LT", phoneCode: "+370" }, { name: "Luxembourg", code: "LU", phoneCode: "+352" }, { name: "Malaysia", code: "MY", phoneCode: "+60" }, { name: "Mexico", code: "MX", phoneCode: "+52" }, { name: "Moldova", code: "MD", phoneCode: "+373" }, { name: "Monaco", code: "MC", phoneCode: "+377" }, { name: "Mongolia", code: "MN", phoneCode: "+976" }, { name: "Montenegro", code: "ME", phoneCode: "+382" }, { name: "Morocco", code: "MA", phoneCode: "+212" }, { name: "Nepal", code: "NP", phoneCode: "+977" }, { name: "Netherlands", code: "NL", phoneCode: "+31" }, { name: "New Zealand", code: "NZ", phoneCode: "+64" }, { name: "Nigeria", code: "NG", phoneCode: "+234" }, { name: "Norway", code: "NO", phoneCode: "+47" }, { name: "Pakistan", code: "PK", phoneCode: "+92" }, { name: "Panama", code: "PA", phoneCode: "+507" }, { name: "Peru", code: "PE", phoneCode: "+51" }, { name: "Philippines", code: "PH", phoneCode: "+63" }, { name: "Poland", code: "PL", phoneCode: "+48" }, { name: "Portugal", code: "PT", phoneCode: "+351" }, { name: "Qatar", code: "QA", phoneCode: "+974" }, { name: "Romania", code: "RO", phoneCode: "+40" }, { name: "Russia", code: "RU", phoneCode: "+7" }, { name: "Saudi Arabia", code: "SA", phoneCode: "+966" }, { name: "Serbia", code: "RS", phoneCode: "+381" }, { name: "Singapore", code: "SG", phoneCode: "+65" }, { name: "Slovakia", code: "SK", phoneCode: "+421" }, { name: "Slovenia", code: "SI", phoneCode: "+386" }, { name: "South Africa", code: "ZA", phoneCode: "+27" }, { name: "South Korea", code: "KR", phoneCode: "+82" }, { name: "Spain", code: "ES", phoneCode: "+34" }, { name: "Sri Lanka", code: "LK", phoneCode: "+94" }, { name: "Sweden", code: "SE", phoneCode: "+46" }, { name: "Switzerland", code: "CH", phoneCode: "+41" }, { name: "Thailand", code: "TH", phoneCode: "+66" }, { name: "Tunisia", code: "TN", phoneCode: "+216" }, { name: "Turkey", code: "TR", phoneCode: "+90" }, { name: "Ukraine", code: "UA", phoneCode: "+380" }, { name: "United Arab Emirates", code: "AE", phoneCode: "+971" }, { name: "United Kingdom", code: "GB", phoneCode: "+44" }, { name: "United States", code: "US", phoneCode: "+1" }, { name: "Uzbekistan", code: "UZ", phoneCode: "+998" }, { name: "Venezuela", code: "VE", phoneCode: "+58" }, { name: "Vietnam", code: "VN", phoneCode: "+84" }, { name: "Yemen", code: "YE", phoneCode: "+967" }, { name: "Zambia", code: "ZM", phoneCode: "+260" }, { name: "Zimbabwe", code: "ZW", phoneCode: "+263" } 
    ];

  const [repeatPassword, setRepeatPassword] = useState("");
  const [newUserData, setNewUserData] = useState({
    username: "",
    password: "",
    email: "",
    phone: "",
    country: "",
    countryCode: ""
  });

  const [serverError,setServerError] = useState("")
  const [loading,setLoading] = useState(false)

  const handleCountryChange = async(countryName: string) => {
    const selected = countries.find(c => c.name === countryName);
    setNewUserData({
      ...newUserData,
      country: countryName,
      countryCode: selected?.phoneCode || ""
    });
  };

  const handleSubmit = async(e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true)
    if (newUserData.password !== repeatPassword) {
      alert("Passwords do not match");
      setLoading(false);
      return;
    }

    try{
        const res = await RegisterUser(newUserData);
        if(!res){
            setServerError("Something went wrong.")
            setLoading(false);
            return;
        }
        if(res.Success==false){
            setServerError(res.Message);
            setLoading(false);
            return;
        }
        
        localStorage.setItem("loggedIn", "true");
        navigate('/dashboard');
        setLoading(false);
    }catch{
        setServerError("Something went wrong.")
        setLoading(false)
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center  bg-[#353535] px-4">
      
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white/5 backdrop-blur-lg rounded-2xl p-6 md:p-8 shadow-xl border border-white/10"
      >
        <h1 className="text-2xl font-bold text-white text-center mb-6">
          Create Account
        </h1>
        {
            serverError !== "" ? (
                <p className="mt-[10px] text-center text-red-500 ">
                    {serverError}
                </p>
            ) : null
        }

        {/* Username */}
        <input
          type="text"
          placeholder="Username"
          className="w-full mb-3 px-4 py-2 rounded-lg bg-black/40 text-white outline-none border border-white/10 focus:border-[#FF7B22]"
          value={newUserData.username}
          onChange={(e) =>
            setNewUserData({ ...newUserData, username: e.target.value })
          }
          required
        />

        {/* Email */}
        <input
          type="email"
          placeholder="Email"
          className="w-full mb-3 px-4 py-2 rounded-lg bg-black/40 text-white outline-none border border-white/10 focus:border-[#FF7B22]"
          value={newUserData.email}
          onChange={(e) =>
            setNewUserData({ ...newUserData, email: e.target.value })
          }
          required
        />

        {/* Country */}
        <select
          className="w-full mb-3 px-4 py-2 rounded-lg bg-black/40 text-white outline-none border border-white/10 focus:border-[#FF7B22]"
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
            className="w-1/3 px-4 py-2 rounded-lg bg-black/40 text-white outline-none border border-white/10"
            value={newUserData.countryCode}
            readOnly
          />
          <input
            type="tel"
            placeholder="Phone number"
            className="w-2/3 px-4 py-2 rounded-lg bg-black/40 text-white outline-none border border-white/10 focus:border-[#FF7B22]"
            value={newUserData.phone}
            onChange={(e) =>
              setNewUserData({ ...newUserData, phone: e.target.value })
            }
            required
          />
        </div>

        {/* Password */}
        <input
          type="password"
          placeholder="Password"
          className="w-full mb-3 px-4 py-2 rounded-lg bg-black/40 text-white outline-none border border-white/10 focus:border-[#FF7B22]"
          value={newUserData.password}
          onChange={(e) =>
            setNewUserData({ ...newUserData, password: e.target.value })
          }
          required
        />

        {/* Repeat Password */}
        <input
          type="password"
          placeholder="Repeat password"
          className="w-full mb-4 px-4 py-2 rounded-lg bg-black/40 text-white outline-none border border-white/10 focus:border-[#FF7B22]"
          value={repeatPassword}
          onChange={(e) => setRepeatPassword(e.target.value)}
          required
        />

        {/* Submit */}
        {
            loading == false ? (
                <button
                type="submit"
                className="w-full py-2 rounded-lg bg-[#FF7B22] hover:scale-105 cursor-pointer transition text-white font-semibold"
                >
                    Register
                </button>
            ) : (
                <button
                className="w-full py-2 rounded-lg bg-[#FF7B22]/50 disabled cursor-pointer transition text-white font-semibold"
                >
                    Loading
                </button>
            )
        }

        <p className="text-sm text-gray-400 text-center mt-4">
          Already have an account?{" "}
          <Link to={'/login'} className="text-[#FF7B22] cursor-pointer hover:underline">
            Login
          </Link>   
        </p>
      </form>
    </div>
  );
};

export default Register;
