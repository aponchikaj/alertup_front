import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getFloor } from "../../apis/building";

interface FloorData {
  floor: string;
  map: string;
  qrCode: string;
  scanned: string[];
  createdAt: string;
}

interface ApiResponse {
  Success: boolean;
  Message: {
    buildingName: string;
    floorData: FloorData;
    scannedCount: number;
  };
}

const Floor = () => {
  const { id, floor } = useParams<{ id: string; floor: string }>();

  const [floorData, setFloorData] = useState<FloorData | null>(null);
  const [buildingName, setBuildingName] = useState("");
  const [scannedCount, setScannedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    const fetchFloorData = async () => {
      try {
        const res: ApiResponse = await getFloor({ id, floor });
        console.log("Floor API response:", res);

        if (!res ) {
          setServerError("Something went wrong");
          return;
        }

        const data = res.Message.floorData;
        if (!data) {
          setServerError("Floor data not found");
          return;
        }

        setFloorData(data);
        setBuildingName(res.Message.buildingName);
        setScannedCount(res.Message.scannedCount);
      } catch (err) {
        console.error(err);
        setServerError("Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchFloorData();
  }, [id, floor]);

  const handlePrintQRCode = (type: "poster" | "card" = "poster") => {
  if (!floorData) return;

  const w = window.open("", "PRINT", "width=900,height=1200");
  if (!w) return;

  const isCard = type === "card";

  w.document.write(`
    <html>
      <head>
        <title>Print QR</title>
        <style>
          @page {
            size: ${isCard ? "90mm 55mm" : "A4"};
            margin: ${isCard ? "2mm" : "0"};
          }

          body {
            margin: 0;
            font-family: Arial, Helvetica, sans-serif;
          }

          /* ================= CARD ================= */
          .card {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
          }

          .card-title {
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
            margin-top: 2mm;
          }

          .card-qr {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
          }

          .card-qr img {
            width: 100%;
            max-height: 85%;
            aspect-ratio: 1 / 1;
          }

          .card-footer {
            font-size: 8px;
            margin-bottom: 2mm;
            letter-spacing: 0.3px;
          }

          /* ================= POSTER ================= */
          .poster {
            width: 100%;
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }

          .header {
            background: #FF7B22;
            color: white;
            padding: 40px;
            text-align: center;
          }

          .header h1 {
            margin: 0;
            font-size: 42px;
            text-transform: uppercase;
          }

          .header p {
            margin-top: 8px;
            font-size: 18px;
          }

          .content {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .qr-box {
            border: 6px solid #FF7B22;
            border-radius: 24px;
            padding: 40px;
            text-align: center;
          }

          .qr-box img {
            width: 300px;
            height: 300px;
          }

          .scan-text {
            margin-top: 20px;
            font-size: 20px;
            font-weight: bold;
          }

          .footer {
            background: #111;
            color: white;
            padding: 20px;
            text-align: center;
            font-size: 14px;
          }
        </style>
      </head>

      <body>
        ${
          isCard
            ? `
              <div class="card">
                <div class="card-title">Escape Route</div>

                <div class="card-qr">
                  <img src="${floorData.qrCode}" />
                </div>

                <div class="card-footer">www.alertup.world</div>
              </div>
            `
            : `
              <div class="poster">
                <div class="header">
                  <h1>Emergency Escape Route</h1>
                  <p>${buildingName} — ${floorData.floor}</p>
                </div>

                <div class="content">
                  <div class="qr-box">
                    <img src="${floorData.qrCode}" />
                    <div class="scan-text">SCAN FOR EXIT MAP</div>
                  </div>
                </div>

                <div class="footer">www.alertup.world</div>
              </div>
            `
        }
      </body>
    </html>
  `);

  w.document.close();
  w.focus();
  w.print();
  w.close();
};

  if (loading)
    return (
      <main className="flex items-center justify-center min-h-screen bg-[#353535]">
        <p className="text-[#FF7B22] animate-pulse text-lg">Loading floor data...</p>
      </main>
    );

  if (serverError)
    return (
      <main className="flex items-center justify-center min-h-screen bg-[#353535]">
        <p className="text-red-500 text-lg">{serverError}</p>
      </main>
    );

  return (
    <main className="min-h-screen bg-[#353535] p-6 flex flex-col items-center">
      {/* Top spacing for navbar */}
      <div className="h-[10vh]" />

      {/* Page Title */}
      <header className="w-full max-w-6xl px-4 mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-center md:text-start text-white">
          {buildingName} <br/> {floorData?.floor}
        </h1>
      </header>

      {/* Map Card */}
      <div className="w-full max-w-6xl bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-xl mb-6 flex flex-col items-center">
        <h2 className="text-2xl font-bold mb-4 text-white">Floor Map</h2>
        <img
          src={floorData?.map}
          alt={`Map of ${floorData?.floor}`}
          className="w-full h-auto rounded-xl shadow-lg mb-4 object-cover"
        />
      </div>

      {/* Info Card */}
      <div className="w-full max-w-6xl bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-xl mb-6">
        <h2 className="text-2xl font-bold mb-4 text-white">Floor Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat label="Floor Name" value={floorData?.floor} />
          <Stat label="Created At" value={new Date(floorData?.createdAt || "").toLocaleString()} />
          <Stat label="Scanned Count" value={scannedCount} />
        </div>
      </div>

      {/* QR Code Card */}
      <div className="w-full max-w-6xl bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col items-center">
        <h2 className="text-2xl font-bold mb-4 text-white">QR Code</h2>
        <img src={floorData?.qrCode} alt="QR Code" className="w-40 h-40 mb-4" />
        <div className="flex gap-4">
        <button
          onClick={() => handlePrintQRCode("poster")}
          className="bg-[#FF7B22] text-white px-6 py-2 rounded-xl hover:bg-[#e66b1c]"
        >
          Print Poster
        </button>

        <button
          onClick={() => handlePrintQRCode("card")}
          className="bg-white/10 text-white px-6 py-2 rounded-xl border border-white/20 hover:bg-white/20"
        >
          Print Card
        </button>
      </div>
      </div>
    </main>
  );
};

const Stat = ({ label, value }: { label: string; value: any }) => (
  <div className="bg-black/30 rounded-xl p-4 text-center border border-white/10">
    <p className="text-sm text-white/60">{label}</p>
    <p className="text-2xl font-bold text-[#FF7B22]">{value}</p>
  </div>
);

export default Floor;
