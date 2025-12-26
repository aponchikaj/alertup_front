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
    <div className="min-h-screen w-full flex items-center justify-center bg-[#353535] px-4">
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
    </div>
  );
};

export default Contact;
