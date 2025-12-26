import { useEffect, useState } from "react";
import Scanner from "../components/scanner";
import Sponsors from "../components/sponsors";
import { Link } from "react-router-dom";
import { ContactAPI } from "../apis/contact";
import { getMe } from "../apis/me";

const Home = () => {

    const [isLogged, setIsLogged] = useState<boolean>(false);

    useEffect(() => {

        const checkIfLogged = async () => {
            try {
                // Replace this with your real API call
                const res = await getMe() 

                if (!res || res.Success === false) {
                    setIsLogged(false);
                    return;
                }

                // If Success is true
                setIsLogged(true);
            } catch (err) {
                console.error("Login check failed:", err);
                setIsLogged(false);
            }
        };

        checkIfLogged()
        document.title = "Home - Alertup";
    }, []);

    const [contactMessage,setContactMessage] = useState<string>("");
    const [contactLoading,setContactLoading] = useState<boolean>(false);

    const [contactData,setContactData] = useState({
        email:"",
        reason:"",
        message:""
    })

    const SendMessage = async(e:any)=>{
        e.preventDefault()
        setContactLoading(true)
        try{
            const res = await ContactAPI(contactData);
            if(res.Success == false){
                setContactMessage(res.Message)
                setContactLoading(false);
                return;
            }

            setContactMessage("Sent.")
            setContactLoading(false);
            return;
        }catch{
            setContactLoading(false);
            setContactMessage("Sent.")
            console.error('Error occured')
        }
    }

    //for qr code

    const [qrCodeMessage,setQrCodeMessage] = useState("");

   const GetQR = (data: string) => {
    if (!data) return;

    if (!data.includes("alertup")) {
      setQrCodeMessage("Other QR codes can't be used.");
      return;
    }

    try {
        window.location.href = data;
        setQrCodeMessage(""); // Clear any previous message
    } catch (err) {
        console.error("Failed to open QR link:", err);
        setQrCodeMessage("Unable to open QR link.");
    }
    };

    return (
        <>
            {/* HERO */}
            <header className="w-full bg-[#353535] flex flex-col items-center justify-center gap-4 px-3 py-4">
                <section className="w-full h-[12vh]" />

                <section className="w-full flex items-center justify-center mb-[10px]">
                    <div className="rounded-[50px] p-[6px] border border-[#FF7B22] bg-black hover:shadow-xl hover:translate-y-[-3px] ease-in-out duration-200 w-[200px] text-center">
                        <h1 className="text-white text-sm md:text-md font-thin hover:font-medium cursor-pointer">
                            Scan & Be safe
                        </h1>
                    </div>
                </section>

                <main className="w-full min-h-[60vh] flex flex-col items-center justify-center gap-8 md:flex-row md:gap-4">

                    {/* LEFT */}
                    <section className="w-full md:w-1/3 flex flex-col items-center md:items-start justify-center text-center md:text-start gap-4 px-2">
                        <h1 className="text-white text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light leading-tight">
                            Alert<span className="text-[#FF7B22] text-2xl md:text-3xl">up</span>
                        </h1>

                        <p className="text-white text-sm sm:text-md md:text-lg max-w-md">
                            Scan Once & Find the{" "}
                            <span className="text-[#FF7B22] font-medium">
                                Safest Way
                            </span>
                            . Instant access to evacuation routes through QR codes.
                        </p>
                        <p className="text-sm text-[#FF7B22]">Beta</p>
                        {!isLogged ? (
                            <ul className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-white mt-2">
                                <Link to={'/login'} className="font-thin text-lg hover:scale-110 hover:text-[#FF7B22] duration-200">
                                    Log in
                                </Link>
                                <div className="hidden md:flex h-5 w-[1px] bg-[#FF7B22]" />
                                <Link to={'/register'} className="font-thin text-lg hover:scale-110 hover:text-[#FF7B22] duration-200">
                                    Join now
                                </Link>
                            </ul>
                        ) : (
                            <Link to={'/dashboard'} className="text-white text-lg font-thin hover:scale-110 hover:text-[#FF7B22] duration-200">
                                Dashboard
                            </Link>
                        )}
                    </section>

                    {/* RIGHT */}
                    <section className="w-full md:w-1/3 flex flex-col items-center justify-center gap-4">
                        <div className="flex md:hidden ">
                            <Scanner
                                w={250}
                                h={250}
                                foxIcon
                                onScan={(d)=>GetQR(d)}
                            />
                        </div>

                        <div className="hidden md:flex hover:translate-y-[-5px] ease-in-out duration-200">
                            <Scanner
                                w={300}
                                h={300}
                                foxIcon
                                onScan={(d)=>GetQR(d)}
                            />
                        </div>

                        <section className="flex flex-col items-center text-center">
                            { qrCodeMessage == "" ? <p className="text-sm text-[#FF7B22]">or</p> : <p className="text-sm text-red-500">{qrCodeMessage}</p>}
                            <Link to={'/new'} className="text-white font-bold hover:underline">
                                Create new
                            </Link>
                        </section>
                    </section>

                </main>
            </header>

            {/* SPACER */}
            <section className="w-full py-4 bg-[#353535]" />

            {/* SPONSORS */}
            <main className="w-full py-6 flex flex-col items-center justify-center gap-4 bg-[#353535]">
                <div className="w-[200px] h-[1px] bg-[#FF7B22]" />
                <Sponsors />
                <div className="w-[200px] h-[1px] bg-[#FF7B22]" />
            </main>

            {/* ABOUT */}
            <main className="w-full py-6 px-4 flex flex-col items-center justify-center gap-4 bg-[#353535] text-center">
                <h1 className="text-xl md:text-2xl font-medium text-[#FF7B22]">
                    What's this?
                </h1>
                <p className="max-w-[500px] text-sm sm:text-md md:text-lg text-white font-thin leading-relaxed">
                    AlertUp is a building safety platform that provides instant
                    access to evacuation routes through QR codes. Building
                    owners can create digital profiles for their buildings,
                    upload official escape and evacuation maps, and generate QR
                    codes for each location.
                    <br /><br />
                    These QR codes can be printed and placed throughout the
                    building. When scanned, users instantly see escape routes
                    and safety maps, helping them reach exits quickly during
                    emergencies.
                </p>
            </main>

            {/* CONTACT */}
            <main className="w-full bg-[#353535] py-10 px-4 flex items-center justify-center">
            <form
                onSubmit={SendMessage}
                className="w-full max-w-md bg-white/5 backdrop-blur-lg rounded-2xl p-6 md:p-8 shadow-xl border border-white/10 text-white"
            >
                <h1 className="text-2xl font-bold text-center mb-6">
                Contact Us
                </h1>

                {contactMessage !== "" && (
                <p
                    className={`mb-4 text-center text-sm font-semibold ${
                    contactMessage === "Sent."
                        ? "text-green-400"
                        : "text-red-500"
                    }`}
                >
                    {contactMessage}
                </p>
                )}

                {/* Email */}
                <input
                type="email"
                placeholder="Email"
                className="w-full mb-3 px-4 py-2 rounded-lg bg-black/40 text-white outline-none border border-white/10 focus:border-[#FF7B22]"
                value={contactData.email}
                onChange={(e) =>
                    setContactData({ ...contactData, email: e.target.value })
                }
                required
                />

                {/* Reason */}
                <input
                type="text"
                placeholder="Reason"
                className="w-full mb-3 px-4 py-2 rounded-lg bg-black/40 text-white outline-none border border-white/10 focus:border-[#FF7B22]"
                value={contactData.reason}
                onChange={(e) =>
                    setContactData({ ...contactData, reason: e.target.value })
                }
                required
                />

                {/* Message */}
                <textarea
                placeholder="Message"
                className="w-full mb-4 px-4 py-2 resize-none h-[180px] rounded-lg bg-black/40 text-white outline-none border border-white/10 focus:border-[#FF7B22]"
                value={contactData.message}
                onChange={(e) =>
                    setContactData({ ...contactData, message: e.target.value })
                }
                required
                />

                {/* Submit */}
                {!contactLoading ? (
                <button
                    type="submit"
                    className="w-full py-2 rounded-lg bg-[#FF7B22] hover:scale-105 transition text-white font-semibold"
                >
                    Send Message
                </button>
                ) : (
                <button
                    disabled
                    className="w-full py-2 rounded-lg bg-[#FF7B22]/50 cursor-not-allowed text-white font-semibold"
                >
                    Sending...
                </button>
                )}
            </form>
            </main>

        </>
    );
};

export default Home;
