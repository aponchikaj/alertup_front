import { Link } from "react-router-dom";
import PageHeader from "../../components/pageHeader";
import Scanner from "../../components/scanner";
import { useEffect, useState } from "react";

const Scan = () => {
  useEffect(() => {
        document.title = "Scan - AlertUp";
    }, []);
  const [qrCodeMessage, setQrCodeMessage] = useState("");

  // Function called when QR code is scanned
  const GetQR = (data: string) => {
    if (!data) return;

    // Optional: restrict to alertup URLs
    if (!data.includes("alertup")) {
      setQrCodeMessage("Other QR codes can't be used.");
      return;
    }

    try {
      // Redirect immediately to scanned QR link
      window.location.href = data;
      setQrCodeMessage(""); // Clear any previous message
    } catch (err) {
      console.error("Failed to open QR link:", err);
      setQrCodeMessage("Unable to open QR link.");
    }
  };

  return (
    <main className="w-full h-screen p-2 flex flex-col bg-[#353535]">
      {/* Spacer for header */}
      <section className="h-[10vh] w-full" />

      {/* Page Header */}
      <section className="h-auto w-full flex items-center justify-center">
        <PageHeader title="Scan" backIcon={true} />
      </section>

      {/* Scanner Section */}
      <main className="w-full h-[70vh] md:h-full flex flex-col items-center justify-center">
        {/* Small screens */}
        <section className="w-full p-2 flex items-center justify-center md:hidden">
          <Scanner foxIcon={true} onScan={GetQR} w={250} h={250} />
        </section>

        {/* Medium screens */}
        <section className="w-full p-2 hidden md:flex lg:hidden items-center justify-center">
          <Scanner foxIcon={true} onScan={GetQR} w={400} h={400} />
        </section>

        {/* Large screens */}
        <section className="w-full p-2 hidden lg:flex items-center justify-center">
          <Scanner foxIcon={true} onScan={GetQR} w={500} h={500} />
        </section>

        {/* Error message or create new link */}
        <section className="w-full flex flex-col items-center justify-center text-center mt-4">
          {qrCodeMessage && (
            <p className="text-sm md:text-md text-red-500 mb-2">{qrCodeMessage}</p>
          )}
          <p className="text-sm md:text-md text-[#FF7B22] mb-2">or</p>
          <Link
            to="/new"
            className="text-white font-bold hover:underline"
          >
            Create new
          </Link>
        </section>
      </main>
    </main>
  );
};

export default Scan;
