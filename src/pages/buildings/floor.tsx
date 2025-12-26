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

  const handlePrintQRCode = () => {
    if (!floorData) return;
    const w = window.open("", "PRINT", "width=600,height=600");
    if (!w) return;
    w.document.write(`<img src="${floorData.qrCode}" style="width:100%;"/>`);
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
        <button
          onClick={handlePrintQRCode}
          className="bg-[#FF7B22] text-white px-6 py-2 rounded-xl hover:bg-[#e66b1c] transition"
        >
          Print QR Code
        </button>
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
