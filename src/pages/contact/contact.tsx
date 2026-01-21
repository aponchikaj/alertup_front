import { useEffect, useState } from "react";
import { ContactAPI } from "../../apis/contact";

const Contact = () => {

  useEffect(() => {
        document.title = "Contact - AlertUp";
    }, []);

  const [contactMessage, setContactMessage] = useState("");
  const [contactLoading, setContactLoading] = useState(false);

  const [contactData, setContactData] = useState({
    email: "",
    reason: "",
    message: "",
  });

  const SendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactLoading(true);
    setContactMessage("");

    try {
      const res = await ContactAPI(contactData);

      if (res?.Success === false) {
        setContactMessage(res.Message);
        setContactLoading(false);
        return;
      }

      setContactMessage("Sent.");
      setContactLoading(false);
    } catch (err) {
      console.error("Error occurred", err);
      setContactMessage("Sent.");
      setContactLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full border flex flex-col md:flex-row gap-3 items-center justify-around bg-[#353535] px-4">
      <div className="w-full h-[10vh] md:hidden" />
      {/* <section className="text-center flex flex-col items-center justify-center md:items-start md:text-start w-full md:w-1/2">
        <h1 className="text-white text-2xl md:text-[30px] font-bold">About</h1>
        <p className="text-white font-thin w-full">
          AlertUp is a smart safety platform designed to help people stay calm, informed, and protected during emergencies.

          In critical situations like fires, earthquakes, or other building emergencies, panic and lack of information can cost lives. AlertUp solves this by providing instant access to emergency guidance through a simple QR code system. By scanning a QR code placed inside a building, users can immediately see evacuation routes, safety instructions, and real-time alerts specific to their location.

          For building owners and administrators, AlertUp offers powerful tools to manage safety more effectively. These include activity logs, emergency mode controls, analytics, and centralized administration dashboards that help monitor and improve building safety preparedness.

          AlertUp is built with a clear mission:
          to make emergency response faster, clearer, and accessible to everyone.

          We believe safety should not depend on knowing the building layout or waiting for instructions. With AlertUp, critical information is always one scan away.
        </p>
      </section> */}
      <form
        onSubmit={SendMessage}
        className="w-full max-w-md bg-white/5 backdrop-blur-lg rounded-2xl p-6 md:p-8 shadow-xl border border-white/10 text-white w-full md:w-1/2"
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
  );
};

export default Contact;
