import { useEffect, useState } from 'react';
import PageHeader from '../../components/pageHeader';
import Scanner from '../../components/scanner';
import {Link} from 'react-router-dom'

const Scan = () => {
  const [qrCodeMessage, setQrCodeMessage] = useState("");

  useEffect(() => {
    document.title = 'Scan QR Code - AlertUp';
  }, []);

  const GetQR = (data: string) => {
    if (!data) return;

    if (!data.includes("alertup")) {
      setQrCodeMessage("Other QR codes can't be used.");
      return;
    }

    try {
      // Navigate to the scanned QR code URL
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

      {/* Main Content - Camera Scanner */}
      <main className="w-full h-[70vh] md:h-full flex flex-col items-center justify-center">
        <div className="w-full max-w-md mx-auto p-6 flex flex-col items-center justify-center">
          {/* Scanner Component */}
          <div className="flex flex-col md:hidden items-center justify-center">
            <Scanner
              w={250}
              h={250}
              foxIcon
              onScan={(d) => GetQR(d)}
            />
          </div>

          <div className="hidden md:flex flex-col items-center justify-center hover:translate-y-[-5px] ease-in-out duration-200">
            <Scanner
              w={300}
              h={300}
              foxIcon
              onScan={(d) => GetQR(d)}
            />
          </div>

          {/* Message Display */}
          <section className="flex flex-col items-center text-center mt-4">
            {qrCodeMessage === "" ? (
              <p className="text-sm text-white">Or create <Link to={'/new'}><span className="text-[#FF7B22] hover:text-[#FF7B22]/60 ease-in-out duration-200 hover:scale-105">New</span></Link> </p>
            ) : (
              <p className="text-sm text-red-500">{qrCodeMessage}</p>
            )}
          </section>
        </div>
      </main>
    </main>
  );
};

export default Scan;
