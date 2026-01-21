import { useEffect, useState } from "react";
import { deactivateBuilding, deleteBuilding, getMyBuildings } from "../../apis/building";
import { Link } from "react-router-dom";

interface Map {
  floor: string;
  map: string;
  qrCode: string;
  scanned: string[];
  createdAt: string;
}

interface GlobalScan {
  userID: string;
  scannedAt: string;
}

interface Building {
  _id: string;
  buildingName: string;
  floors: string;
  maps: Map[];
  globalScans: GlobalScan[];
  isDeactivated: boolean;
}

const Mybuildings = () => {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null); // track action per building

  useEffect(() => {
    document.title = "My buildings - Alertup";

    const fetchBuildings = async () => {
      setLoading(true);
      setServerError("");

      try {
        const res = await getMyBuildings();
        if (res.Success) setBuildings(res.Message);
        else setServerError(res.Message || "Failed to fetch buildings");
      } catch (err: any) {
        setServerError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchBuildings();
  }, []);

  const handleDeactivationOfBuilding = async (id: string) => {
    const confirm = window.confirm("Are you sure you want to deactivate this building?");
    if (!confirm) return;

    try {
      setActionLoading(id);
      const res = await deactivateBuilding(id);
      if (res.Success) {
        setBuildings((prev) =>
          prev.map((b) => (b._id === id ? { ...b, isDeactivated: true } : b))
        );
      } else {
        alert(res.Message || "Failed to deactivate building.");
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBuildingDelete = async (id: string) => {
    const confirm = window.confirm("Are you sure you want to delete this building?");
    if (!confirm) return;

    try {
      setActionLoading(id);
      const res = await deleteBuilding(id);
      console.log(res)
      if (res.Success) {
        setBuildings((prev) => prev.filter((b) => b._id !== id));
      } else {
        alert(res.Message || "Failed to delete building.");
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <main className="p-4 min-h-screen bg-[#353535]">
      <section className="w-full h-[10vh]" />
      <h1 className="text-2xl font-medium mb-6 text-center text-white">
        My Buildings
      </h1>

      {loading && (
        <p className="text-center text-white animate-pulse text-lg">
          Loading buildings...
        </p>
      )}
      {serverError && (
        <p className="text-center text-red-500 text-lg">{serverError}</p>
      )}
      {!loading && !serverError && buildings.length === 0 && (
        <p className="text-center text-white text-lg">No buildings found.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {buildings.map((b) => (
          <div
            key={b._id}
            className="p-5 rounded-lg shadow-lg hover:shadow-2xl transition transform hover:-translate-y-1 border border-[#FF7B22] text-white flex flex-col justify-between"
          >
            <Link to={`/building/${b._id}`}>
              <div>
                <h2 className="text-xl font-medium mb-2">{b.buildingName}</h2>
                <p className="text-sm md:text-base">
                  <span className="font-medium">Floors:</span> {b.floors}
                </p>
                <p className="text-sm md:text-base">
                  <span className="font-medium">Maps uploaded:</span> {b.maps.length}
                </p>
                <p className="text-sm md:text-base">
                  <span className="font-medium">Global scans:</span> {b.globalScans.length}
                </p>
              </div>
            </Link>

            <p className={`mt-4 font-semibold ${b.isDeactivated ? "text-red-500" : "text-green-400"}`}>
              {b.isDeactivated ? "Inactive" : "Active"}
            </p>

            <button
              onClick={() => handleDeactivationOfBuilding(b._id)}
              className="w-full bg-yellow-500 hover:bg-yellow-600 rounded-[5px] mt-2 py-2 font-medium"
              disabled={actionLoading === b._id || b.isDeactivated}
            >
              {actionLoading === b._id ? "Processing..." : "DEACTIVATE"}
            </button>
            <button
              onClick={() => handleBuildingDelete(b._id)}
              className="w-full bg-red-500 hover:bg-red-600 rounded-[5px] mt-2 py-2 font-medium"
              disabled={actionLoading === b._id}
            >
              {actionLoading === b._id ? "Deleting..." : "DELETE"}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
};

export default Mybuildings;
