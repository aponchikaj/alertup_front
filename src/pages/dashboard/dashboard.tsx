import { useEffect, useState } from "react";
import { getDashboard } from "../../apis/dashboard";

const LABELS: { [key: string]: string } = {
  MyBuildings: "My Buildings",
  scanned: "Total Scans",
  myBuildingsScanned: "My Buildings Scanned",
  lastScan: "Last Scan",
  totalBuildings: "Total Buildings",
  recentNotification: "Recent Notification",
};

const Dashboard = () => {
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    document.title = "Dashboard - AlertUp";

    const getMyDashboard = async () => {
      setLoading(true);
      setServerError("");
      try {
        const res = await getDashboard();
        if (!res) {
          setServerError("Something went wrong.");
          return;
        }
        if (res.Success === false) {
          setServerError(res.Message);
          return;
        }
        setDashboard(res.Message);
      } catch {
        setServerError("Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    getMyDashboard();
  }, []);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <main className="min-h-screen bg-[#353535] text-white px-4 py-16 flex flex-col items-center justify-center">
        <section className="w-full h-[10vh]" />
      {/* HEADER */}
      <section className="max-w-5xl mx-auto text-center mb-16">
        <h1 className="text-3xl md:text-5xl font-bold mb-4">
          Your <span className="text-[#FF7B22]">Dashboard</span>
        </h1>
        <p className="text-gray-300 max-w-2xl mx-auto">
          Overview of your buildings, floors, and analytics.
        </p>
      </section>

      {/* STATES */}
      {loading && (
        <p className="text-center text-gray-400 animate-pulse">
          Loading dashboard...
        </p>
      )}
      {serverError && (
        <p className="text-center text-red-400">{serverError}</p>
      )}

      {/* DASHBOARD CARDS */}
      {!loading && !serverError && dashboard && (
        <section className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {Object.entries(dashboard).map(([key, value], i) => (
            <div
              key={i}
              className="border-2 border-[#FF7B22] rounded-2xl p-8 flex flex-col gap-6 relative hover:scale-105 hover:shadow-2xl transition-transform duration-300 bg-[#353535] animate-fadeIn"
            >
              <span className="absolute top-4 right-4 text-xs bg-[#FF7B22] text-[#353535] px-3 py-1 rounded-full font-semibold">
                INFO
              </span>

              <h2 className="text-2xl font-semibold text-[#FF7B22]">
                {LABELS[key] || key}
              </h2>

              <ul className="text-sm text-gray-300 flex flex-col gap-3">
                {value && typeof value === "object" && !Array.isArray(value) ? (
                    Object.entries(value).map(([k, v], j) => (
                    <li key={j}>
                        ✔ {k.replace(/([A-Z])/g, " $1")}: {v !== null ? v.toString() : "N/A"}
                    </li>
                    ))
                ) : key === "lastScan" ? (
                    <li>✔ {formatDate(value as string)}</li>
                ) : key === "recentNotification" && value && typeof value === "object" ? (
                    <li>
                      ✔ {(value as { Title?: string; summary?: string; to?: string }).Title || "N/A"}:{" "}
                      {(value as { Title?: string; summary?: string; to?: string }).summary || "N/A"} (To:{" "}
                      {(value as { Title?: string; summary?: string; to?: string }).to || "N/A"})
                    </li>
                ) : (
                    <li>✔ {value !== null ? value?.toString() : "N/A"}</li>
                )}
                </ul>
            </div>
          ))}
        </section>
      )}
    </main>
  );
};

export default Dashboard;
