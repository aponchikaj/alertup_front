import { useEffect, useState } from "react";
import { getBuilding } from "../../apis/building";
import { getMe } from "../../apis/me";
import { Link, useParams } from "react-router-dom";

const Building = () => {
  const { buildingID } = useParams();

  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [buildingData, setBuildingData] = useState<any>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);


  useEffect(() => {
    const getBuildingData = async () => {
      setLoading(true);
      try {
        const res = await getBuilding({ buildingID });

        if (!res || res.Success === false) {
          setServerError(res?.Message || "Something went wrong.");
          setLoading(false);
          return;
        }

        setBuildingData(res.Message);

        // Check if current user is the owner
        const meRes = await getMe();
        
        // Try alternative methods if getMe fails
        let currentUserId = meRes?.user?._id;
        
        if (!currentUserId && meRes?.Message?._id) {
          currentUserId = meRes.Message._id;
        }
        
        if (!currentUserId && meRes?.Message?.user?._id) {
          currentUserId = meRes.Message.user._id;
        }
        
        if (!currentUserId) {
          // Try to get user ID from localStorage token first
          const userToken = localStorage.getItem('userToken');
          
          if (userToken) {
            try {
              // Decode JWT token to get user ID
              const tokenParts = userToken.split('.');
              if (tokenParts.length === 3) {
                const payload = JSON.parse(atob(tokenParts[1]));
                currentUserId = payload.userId || payload.userID || payload.user_id || payload._id;
              }
            } catch (error) {
              // Failed to decode JWT token from localStorage
            }
          }
          
          // If still no user ID, try cookies
          if (!currentUserId) {
            const cookies = document.cookie.split(';');
            for (const cookie of cookies) {
              const [name, value] = cookie.trim().split('=');
              if (name === 'token' || name === 'authToken' || name === 'jwt') {
                try {
                  // Decode JWT token to get user ID
                  const tokenParts = value.split('.');
                  if (tokenParts.length === 3) {
                    const payload = JSON.parse(atob(tokenParts[1]));
                    currentUserId = payload.userId;
                    break;
                  }
                } catch (error) {
                  // Failed to decode JWT token
                }
              }
            }
          }
        }
        
        if (currentUserId) {
          const isUserOwner = currentUserId === res.Message.owner._id;
          setIsOwner(isUserOwner);
        } else {
          setIsOwner(false);
        }
      } catch {
        setServerError("Something went wrong.");
      } finally {
        setLoading(false);
      }
    };

    getBuildingData();
  }, [buildingID]);

  return (
    <main className="w-full min-h-screen bg-[#353535] text-white flex flex-col items-center justify-center">
        {/* <section className="w-full h-[10vh] " /> */}
      {/* Top spacing for navbar */}
      <div className="h-[10vh]" />

      {/* Page Title */}
      <header className="w-full max-w-6xl px-4 mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-center md:text-start">
          Building Overview
        </h1>
      </header>

      {/* Loading */}
      {loading && (
        <p className="text-[#FF7B22] animate-pulse">Loading building...</p>
      )}

      {/* Error */}
      {serverError && (
        <p className="text-red-500 mt-4">{serverError}</p>
      )}

      {/* Content */}
      {buildingData && (
        <section className="w-full max-w-6xl px-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* MAIN INFO CARD */}
          <div className="lg:col-span-2 bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-xl">
            <h2 className="text-2xl font-bold mb-2">
              {buildingData.buildingName}
            </h2>

            <p className="text-white/70 text-sm mb-6">
              Last updated: {new Date(buildingData.updatedAt).toLocaleString()}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Stat label="Floors" value={buildingData.floors} />
              <Stat label="Global Scans" value={buildingData.globalScans.length} />
              <Stat label="Maps" value={buildingData.maps.length} />
            </div>
          </div>

          {/* STATUS CARD */}
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-semibold mb-4">Status</h3>

              <p className="text-sm mb-2">
                Active:
                <span
                  className={`ml-2 font-bold ${
                    buildingData.isDeactivated
                      ? "text-red-500"
                      : "text-green-400"
                  }`}
                >
                  {buildingData.isDeactivated ? "No" : "Yes"}
                </span>
              </p>

              <p className="text-sm">
                Owner:
                <span className="block mt-1 text-white/70 break-all">
                  {buildingData.owner.username}
                </span>
              </p>
              <p className="text-sm">
                Owner Email:
                <span className="block mt-1 text-white/70 break-all">
                  {buildingData.owner.email}
                </span>
              </p>
            </div>

            {/* Emergency Routing Button - Only for building owners */}
            {isOwner && (
              <Link
                to={`/building/${buildingData._id}/nodes`}
                className="mt-4 w-full py-2 bg-[#FF7B22] text-white rounded-lg hover:bg-[#FF7B22]/80 text-center font-semibold"
              >
                🚨 Manage Emergency Routes
              </Link>
            )}
          </div>

          {/* MAPS SECTION */}
          <div className="lg:col-span-3 bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-xl">
            <h3 className="text-xl font-semibold mb-4">Maps</h3>

            {buildingData.maps.length === 0 ? (
                <p className="text-white/60">No maps available</p>
                ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {buildingData.maps.map((map: any) => (
                    <Link
                        key={map._id}
                        to={`/building/${buildingData._id}/${map.floor}`}
                        className="bg-black/30 border border-white/10 rounded-xl p-4 hover:border-[#FF7B22] transition"
                    >
                        <p className="font-semibold mb-1">
                        Floor {map.floor}
                        </p>
                        <p className="text-sm text-white/60">
                        Scans: {map.scanned?.length || 0}
                        </p>
                    </Link>
                    ))}
                </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
};

const Stat = ({ label, value }: { label: string; value: any }) => (
  <div className="bg-black/30 rounded-xl p-4 text-center border border-white/10">
    <p className="text-sm text-white/60">{label}</p>
    <p className="text-2xl font-bold text-[#FF7B22]">{value}</p>
  </div>
);

export default Building;
